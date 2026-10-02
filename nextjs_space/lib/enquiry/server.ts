// Server-only enquiry handling. The recipient is read from
// BIOVERACITY_ENQUIRY_RECIPIENT at request time and is never returned, logged or
// embedded in client code. Enquiries are delivered by email only; nothing is
// written to the evidence/customer database.
import {
  ENQUIRY_CTAS, ENQUIRY_LIMITS, ENQUIRY_SOURCES, ENQUIRY_TYPES,
  resolveEnquiryContext, type EnquiryCta, type EnquirySource, type EnquiryType,
} from './config'

export type Enquiry = {
  name: string
  email: string
  organisation: string | null
  type: EnquiryType
  message: string
  source: EnquirySource
  cta: EnquiryCta | null
  requestId: string
}

export class EnquiryValidationError extends Error {}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/
const REQUEST_ID_RE = /^[A-Za-z0-9-]{16,64}$/

function text(v: unknown, max: number, required: boolean, field: string): string | null {
  if (v == null || v === '') {
    if (required) throw new EnquiryValidationError(`${field} is required`)
    return null
  }
  if (typeof v !== 'string') throw new EnquiryValidationError(`${field} is invalid`)
  // Strip control characters (keeps newlines/tabs in the message).
  const clean = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (!clean) {
    if (required) throw new EnquiryValidationError(`${field} is required`)
    return null
  }
  if (clean.length > max) throw new EnquiryValidationError(`${field} is too long`)
  return clean
}

export type ParsedEnquiry = { spam: true } | { spam: false; enquiry: Enquiry }

export function parseEnquiry(body: unknown): ParsedEnquiry {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EnquiryValidationError('Malformed enquiry')
  const b = body as Record<string, unknown>
  // Honeypot: real visitors never see or fill this field.
  if (typeof b.website_url === 'string' && b.website_url.trim() !== '') return { spam: true }
  const name = text(b.name, ENQUIRY_LIMITS.name, true, 'Name')!
  const email = text(b.email, ENQUIRY_LIMITS.email, true, 'Email')!.toLowerCase()
  if (!EMAIL_RE.test(email)) throw new EnquiryValidationError('Email is invalid')
  if (/[\r\n]/.test(name)) throw new EnquiryValidationError('Name is invalid')
  const organisation = text(b.organisation, ENQUIRY_LIMITS.organisation, false, 'Organisation')
  if (organisation && /[\r\n]/.test(organisation)) throw new EnquiryValidationError('Organisation is invalid')
  const type = b.type
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(ENQUIRY_TYPES, type)) throw new EnquiryValidationError('Enquiry type is invalid')
  const message = text(b.message, ENQUIRY_LIMITS.message, true, 'Message')!
  const requestId = b.requestId
  if (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId)) throw new EnquiryValidationError('Malformed enquiry')
  const { source, cta } = resolveEnquiryContext(b.source, b.cta)
  return { spam: false, enquiry: { name, email, organisation, type: type as EnquiryType, message, source, cta, requestId } }
}

// ---- Per-process abuse controls (memory only; reset on restart, not shared across instances).
type Store = { hits: Map<string, number[]>; done: Map<string, { at: number; fingerprint: string }>; inflight: Set<string> }
const g = globalThis as unknown as { __bvEnquiry?: Store }
export function enquiryStore(): Store {
  if (!g.__bvEnquiry) g.__bvEnquiry = { hits: new Map(), done: new Map(), inflight: new Set() }
  return g.__bvEnquiry
}

export const RATE_LIMITS = { ipPer10Min: 5, sharedPer10Min: 30, emailPerHour: 3 } as const

function allow(store: Store, key: string, limit: number, windowMs: number, now: number): boolean {
  const recent = (store.hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) { store.hits.set(key, recent); return false }
  recent.push(now)
  store.hits.set(key, recent)
  return true
}

// ip === null means the forwarded address cannot be trusted: use one shared bucket.
export function checkRateLimit(store: Store, ip: string | null, email: string, now = Date.now()): boolean {
  if (store.hits.size > 5000) store.hits.clear()
  const ipOk = ip === null
    ? allow(store, 'ip:shared', RATE_LIMITS.sharedPer10Min, 10 * 60_000, now)
    : allow(store, `ip:${ip}`, RATE_LIMITS.ipPer10Min, 10 * 60_000, now)
  if (!ipOk) return false
  return allow(store, `email:${email}`, RATE_LIMITS.emailPerHour, 60 * 60_000, now)
}

export function fingerprint(e: Enquiry): string {
  return [e.email, e.name, e.type, e.source, e.cta ?? '', e.message].join('\u001f')
}

const DEDUPE_MS = 60 * 60_000

// Returns 'duplicate' if this requestId already delivered the same enquiry,
// 'conflict' if it delivered a different one, 'inflight' if a send is running.
export function claim(store: Store, e: Enquiry, now = Date.now()): 'ok' | 'duplicate' | 'conflict' | 'inflight' {
  for (const [k, v] of store.done) if (now - v.at > DEDUPE_MS) store.done.delete(k)
  const prior = store.done.get(e.requestId)
  if (prior) return prior.fingerprint === fingerprint(e) ? 'duplicate' : 'conflict'
  if (store.inflight.has(e.requestId)) return 'inflight'
  store.inflight.add(e.requestId)
  return 'ok'
}

export function settle(store: Store, e: Enquiry, delivered: boolean, now = Date.now()) {
  store.inflight.delete(e.requestId)
  if (delivered) store.done.set(e.requestId, { at: now, fingerprint: fingerprint(e) })
}

// Recipient lookup: a single server-side env var. Returns null when missing or malformed.
export function enquiryRecipient(env: Record<string, string | undefined>): string | null {
  const r = env.BIOVERACITY_ENQUIRY_RECIPIENT?.trim()
  return r && EMAIL_RE.test(r) ? r : null
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function buildEnquiryEmail(e: Enquiry) {
  const sourceLabel = ENQUIRY_SOURCES[e.source].label
  const ctaLabel = e.cta ? ENQUIRY_CTAS[e.cta].label : 'Direct'
  const rows: Array<[string, string]> = [
    ['Source', sourceLabel],
    ['CTA', e.cta ? `${ctaLabel} [${e.cta}]` : ctaLabel],
    ['Name', e.name],
    ['Email', e.email],
    ['Organisation', e.organisation ?? '—'],
    ['Responsible for', ENQUIRY_TYPES[e.type]],
    ['Reference', e.requestId],
  ]
  const subject = `BioVeracity enquiry · ${sourceLabel} · ${e.name}`.slice(0, 180)
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${e.message}\n`
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px"><h2 style="border-bottom:2px solid #e6b800;padding-bottom:8px">New BioVeracity enquiry</h2>${rows
    .map(([k, v]) => `<p style="margin:6px 0"><strong>${esc(k)}:</strong> ${esc(v)}</p>`)
    .join('')}<p style="margin:12px 0 4px"><strong>Message:</strong></p><div style="white-space:pre-wrap;border-left:4px solid #e6b800;padding:10px">${esc(e.message)}</div></div>`
  return { subject, text, html }
}
