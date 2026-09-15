'use client'

// Reviewer screen for a customer-created Opportunity Assessment.
//
// Natalia reviews the machine-read extraction BEFORE any PDF exists. She can:
//   * correct a field's value, category and locator,
//   * add private comments, each with an explicit "include in brief" toggle,
//   * record a decision (Bid / Partner / Monitor / Pass / Not sure yet),
//   * mark the assessment reviewed.
// Only after it is marked reviewed can a qualification PDF be generated, and
// only comments flagged includeInBrief ever reach that PDF. The extraction is
// never auto-published; this is private working material.

import { useEffect, useState, useCallback } from 'react'

type Category = 'SOURCE FACT' | 'BIOVERACITY ANALYSIS' | 'ELLONA INPUT' | 'UNKNOWN'
const CATEGORIES: Category[] = ['SOURCE FACT', 'BIOVERACITY ANALYSIS', 'ELLONA INPUT', 'UNKNOWN']

type Field = { key: string; label: string; value: string; category: Category; locator: string | null }
type Comment = { text: string; includeInBrief: boolean; at?: string }
type Correction = { value?: string; category?: Category; locator?: string }

type Assessment = {
  id: string
  title: string
  status: string
  decisionType: string
  documentName: string
  mediaType: string
  parserVersion: string
  extraction: { version: string; model: string; fields: Field[]; warnings: string[]; passageCount: number }
  corrections: Record<string, Correction>
  comments: Comment[]
  reviewedAt: string | null
  createdAt: string
}

const DECISIONS = [
  { value: 'BID', label: 'Bid' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PASS', label: 'Pass' },
  { value: 'UNSURE', label: 'Not sure yet' },
]

function catClass(cat: Category): string {
  return 'bv-tag bv-tag-cat cat-' + cat.toLowerCase().replace(/[^a-z]+/g, '-')
}

export function AssessReview({ id, readOnly }: { id: string; readOnly: boolean }) {
  const [data, setData] = useState<Assessment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [corrections, setCorrections] = useState<Record<string, Correction>>({})
  const [comments, setComments] = useState<Comment[]>([])
  const [decision, setDecision] = useState('UNSURE')
  const [newComment, setNewComment] = useState('')
  const [newCommentInBrief, setNewCommentInBrief] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ellona/assessment/${id}`, { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error || 'This assessment could not be loaded.')
        setLoading(false)
        return
      }
      setData(d)
      setCorrections(d.corrections || {})
      setComments(Array.isArray(d.comments) ? d.comments : [])
      setDecision(d.decisionType || 'UNSURE')
    } catch {
      setError('This assessment could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const setCorrection = (key: string, patch: Correction) => {
    setCorrections((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const effective = (f: Field): Field => {
    const c = corrections[f.key] || {}
    return {
      ...f,
      value: c.value !== undefined ? c.value : f.value,
      category: (c.category as Category) || f.category,
      locator: c.locator !== undefined ? c.locator : f.locator,
    }
  }

  const save = async (opts: { markReviewed?: boolean } = {}) => {
    setSaving(true)
    setSaveMsg('')
    setError('')
    try {
      const res = await fetch(`/api/ellona/assessment/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ corrections, comments, decisionType: decision, markReviewed: opts.markReviewed === true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error || 'Your changes could not be saved.')
        setSaving(false)
        return
      }
      setSaveMsg(opts.markReviewed ? 'Marked as reviewed.' : 'Changes saved.')
      await load()
    } catch {
      setError('Your changes could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const addComment = () => {
    if (!newComment.trim()) return
    setComments((prev) => [...prev, { text: newComment.trim(), includeInBrief: newCommentInBrief }])
    setNewComment('')
    setNewCommentInBrief(false)
  }

  if (loading) return <p className="bv-lead">Loading the assessment…</p>
  if (error && !data)
    return (
      <div className="bv-danger" style={{ marginTop: 12 }}>
        {error}
      </div>
    )
  if (!data) return null

  const reviewed = data.status === 'REVIEWED'
  const fields = data.extraction?.fields || []
  const warnings = data.extraction?.warnings || []

  return (
    <div>
      <div className="bv-eyebrow">Opportunity assessment</div>
      <h1 style={{ marginTop: 8 }}>{data.title}</h1>
      <p className="bv-lead" style={{ marginTop: 8 }}>
        Read from <strong>{data.documentName}</strong>. This is private working material for your team. Review and
        correct each field before generating a qualification brief. Nothing here is published or shared.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        <span className="bv-tag bv-tag-status">{data.status}</span>
        <span className="bv-tag">{data.extraction?.passageCount ?? 0} passages read</span>
        <span className="bv-tag">{fields.filter((f) => effective(f).category === 'SOURCE FACT').length} source facts</span>
        <span className="bv-tag">{fields.filter((f) => effective(f).category === 'UNKNOWN').length} not located</span>
      </div>

      {warnings.length > 0 && (
        <div className="bv-notice" style={{ marginTop: 16 }}>
          <strong>Coverage notes:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {readOnly && (
        <div className="bv-notice" style={{ marginTop: 16 }}>
          Your trial is read-only, so corrections, comments and review sign-off are disabled. You can still read the
          extraction.
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Qualification fields</h2>
      <p style={{ fontSize: 14, color: '#5b6157', marginTop: 4 }}>
        Each fact carries a category and, where it comes from the document, a precise locator you can check. Blanks
        are honest — they mean the fact was not located in the document.
      </p>

      <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
        {fields.map((f) => {
          const e = effective(f)
          return (
            <div key={f.key} className="bv-ellona-panel" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong className="bv-field-label" style={{ fontSize: 15 }}>
                  {f.label}
                </strong>
                <span className={catClass(e.category)}>{e.category}</span>
              </div>
              {readOnly ? (
                <p className="bv-field-val" style={{ marginTop: 8 }}>
                  {e.value || <em style={{ color: '#8a8f83' }}>Not located in the document.</em>}
                </p>
              ) : (
                <>
                  <textarea
                    value={e.value}
                    onChange={(ev: any) => setCorrection(f.key, { value: ev?.target?.value ?? '' })}
                    rows={2}
                    style={taStyle}
                    placeholder="Not located in the document."
                  />
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    <label style={{ fontSize: 13 }}>
                      Category{' '}
                      <select
                        value={e.category}
                        onChange={(ev: any) => setCorrection(f.key, { category: ev?.target?.value })}
                        style={selStyle}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ fontSize: 13, flex: 1, minWidth: 200 }}>
                      Locator{' '}
                      <input
                        value={e.locator || ''}
                        onChange={(ev: any) => setCorrection(f.key, { locator: ev?.target?.value ?? '' })}
                        placeholder="e.g. Page 3, paragraph 2"
                        style={{ ...selStyle, width: '100%' }}
                      />
                    </label>
                  </div>
                </>
              )}
              {readOnly && e.locator && <div className="bv-locator">{e.locator}</div>}
            </div>
          )
        })}
      </div>

      <h2 style={{ marginTop: 28 }}>Your decision</h2>
      <label className="bv-field-label" htmlFor="decision" style={{ marginTop: 6 }}>
        What do you want to do with this opportunity?
      </label>
      <select
        id="decision"
        value={decision}
        onChange={(e: any) => setDecision(e?.target?.value)}
        disabled={readOnly}
        style={{ ...selStyle, marginTop: 6 }}
      >
        {DECISIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <h2 style={{ marginTop: 28 }}>Private comments</h2>
      <p style={{ fontSize: 14, color: '#5b6157', marginTop: 4 }}>
        Comments are private to your workspace. Only comments you explicitly mark “include in brief” appear in a
        generated PDF.
      </p>
      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {comments.map((c, i) => (
          <div key={i} className="bv-comment">
            <div>{c.text}</div>
            <div style={{ fontSize: 12, color: '#5b6157', marginTop: 4 }}>
              {c.includeInBrief ? 'Included in brief' : 'Private — not in brief'}
              {!readOnly && (
                <button
                  type="button"
                  className="bv-text-link"
                  style={{ marginLeft: 10 }}
                  onClick={() =>
                    setComments((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, includeInBrief: !x.includeInBrief } : x)),
                    )
                  }
                >
                  {c.includeInBrief ? 'Make private' : 'Include in brief'}
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="bv-text-link"
                  style={{ marginLeft: 10 }}
                  onClick={() => setComments((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {comments.length === 0 && <p style={{ fontSize: 14, color: '#8a8f83' }}>No comments yet.</p>}
      </div>

      {!readOnly && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={newComment}
            onChange={(e: any) => setNewComment(e?.target?.value ?? '')}
            rows={2}
            placeholder="Add a private comment…"
            style={taStyle}
          />
          <label style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={newCommentInBrief}
              onChange={(e: any) => setNewCommentInBrief(!!e?.target?.checked)}
            />
            Include this comment in a generated brief
          </label>
          <button type="button" className="bv-button" style={{ marginTop: 8 }} onClick={addComment}>
            Add comment
          </button>
        </div>
      )}

      {error && (
        <div className="bv-danger" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}
      {saveMsg && (
        <div className="bv-ok" style={{ marginTop: 18 }}>
          {saveMsg}
        </div>
      )}

      {!readOnly && (
        <div className="bv-ellona-actions" style={{ marginTop: 20 }}>
          <button type="button" className="bv-button" disabled={saving} onClick={() => save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="bv-button bv-green" disabled={saving} onClick={() => save({ markReviewed: true })}>
            {saving ? 'Saving…' : 'Save and mark reviewed'}
          </button>
        </div>
      )}

      <h2 style={{ marginTop: 28 }}>Qualification brief (PDF)</h2>
      {reviewed ? (
        <div>
          <p style={{ fontSize: 14, color: '#5b6157', marginTop: 4 }}>
            This assessment is marked reviewed. The brief reflects your corrections and only the comments you chose to
            include.
          </p>
          <a className="bv-button bv-green" href={`/api/ellona/assessment/${id}/pdf`} style={{ marginTop: 10 }}>
            Download qualification brief
          </a>
        </div>
      ) : (
        <div className="bv-notice" style={{ marginTop: 6 }}>
          The qualification brief becomes available once you have reviewed the fields and marked the assessment
          reviewed. This ensures no machine-read draft is turned into a brief without a human check.
        </div>
      )}
    </div>
  )
}

const taStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '2px solid #d8d4c4',
  background: '#fff',
  fontSize: 15,
  marginTop: 8,
  fontFamily: 'inherit',
}

const selStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '2px solid #d8d4c4',
  background: '#fff',
  fontSize: 14,
}
