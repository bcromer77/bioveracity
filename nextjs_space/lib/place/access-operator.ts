// Operator-only controls for Place Access Points (Place Experience PR E).
//
// Server-side boundary, independent of any UI:
// - every request is decided by `operatorAccess` (admin role) first:
//   no session -> 401, any other role -> 403;
// - the controls are dark unless both the server-only Place Experience flag and
//   PLACE_ACCESS_OPERATOR_ENABLED are exactly 'true' (absent by default, so there
//   is no production issuance capability);
// - mutations additionally require a same-origin request (CSRF), which is a
//   request check only; the QR payload never uses the request Host;
// - there is no public issuance path: the public /p route only resolves.

import QRCode from 'qrcode'
import type { Database } from '@/lib/workspaces/service'
import { operatorAccess } from '@/lib/v1-operator/access'
import { isPlaceExperienceEnabled } from './shell-loader'
import {
  PLACE_ACCESS_QR_OPTIONS,
  PlaceAccessError,
  accessPointQrPayload,
  isActiveAccessPoint,
  isPublicAccessId,
  issueAccessPoint,
  publicPlaceOrigin,
  revokeAccessPoint,
} from './access-points'

type Env = Record<string, string | undefined>
export type OperatorContext = { session: unknown; db: Database; env?: Env }
export type OperatorResponse = { status: number; headers: Record<string, string>; body: string }

export const OPERATOR_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
})

export function isPlaceAccessOperatorEnabled(env: Env = process.env): boolean {
  return isPlaceExperienceEnabled(env) && env.PLACE_ACCESS_OPERATOR_ENABLED === 'true'
}

const json = (status: number, value: unknown): OperatorResponse => ({
  status,
  headers: { ...OPERATOR_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(value),
})

function gate(ctx: OperatorContext): OperatorResponse | null {
  const access = operatorAccess(ctx.session)
  if (access === 'unauthenticated') return json(401, { error: 'Sign in required' })
  if (access !== 'allowed') return json(403, { error: 'Operator access required' })
  if (!isPlaceAccessOperatorEnabled(ctx.env ?? process.env)) return json(503, { error: 'Place access points are not enabled' })
  return null
}

const ERROR_STATUS: Record<string, number> = {
  malformed_place_id: 400,
  malformed_access_id: 400,
  place_not_found: 404,
  access_point_not_found: 404,
  issue_retry_exhausted: 503,
}

/** POST body: { action: 'issue', placeId } | { action: 'revoke', publicAccessId } */
export async function handleAccessPointAction(
  ctx: OperatorContext,
  request: { origin: string | null; requestOrigin: string; body: unknown },
): Promise<OperatorResponse> {
  const denied = gate(ctx)
  if (denied) return denied
  if (!request.origin || request.origin !== request.requestOrigin) return json(403, { error: 'Same-origin request required' })
  const body = (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, unknown>
  try {
    if (body.action === 'issue') return json(201, await issueAccessPoint(ctx.db, body.placeId))
    if (body.action === 'revoke') return json(200, await revokeAccessPoint(ctx.db, body.publicAccessId))
    return json(400, { error: 'Unknown action' })
  } catch (error) {
    if (error instanceof PlaceAccessError) return json(ERROR_STATUS[error.code] ?? 400, { error: error.code })
    return json(503, { error: 'Access point store unavailable' })
  }
}

/** GET: printable QR SVG for an ACTIVE access point, payload `${origin}/p/${id}`. */
export async function handleAccessPointQr(ctx: OperatorContext, rawId: unknown, download = false): Promise<OperatorResponse> {
  const denied = gate(ctx)
  if (denied) return denied
  const origin = publicPlaceOrigin(ctx.env ?? process.env)
  if (!origin) return json(503, { error: 'Public origin is not configured' })
  if (!isPublicAccessId(rawId)) return json(400, { error: 'malformed_access_id' })
  try {
    if (!(await isActiveAccessPoint(ctx.db, rawId))) return json(404, { error: 'access_point_not_found' })
  } catch {
    return json(503, { error: 'Access point store unavailable' })
  }
  const svg = await QRCode.toString(accessPointQrPayload(origin, rawId), {
    ...PLACE_ACCESS_QR_OPTIONS,
    color: { ...PLACE_ACCESS_QR_OPTIONS.color },
  })
  const headers: Record<string, string> = { ...OPERATOR_HEADERS, 'Content-Type': 'image/svg+xml' }
  if (download) headers['Content-Disposition'] = `attachment; filename="place-access-${rawId}-qr.svg"`
  return { status: 200, headers, body: svg }
}
