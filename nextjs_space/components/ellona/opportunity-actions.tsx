'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function OpportunityActions({
  id,
  following,
  readOnly,
}: {
  id: string
  following: boolean
  readOnly: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function act(kind: string, detail?: string) {
    setBusy(kind)
    setMsg(null)
    try {
      const res = await fetch(`/api/ellona/opportunity/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, detail: detail || '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ kind: 'err', text: data?.error || 'Action failed.' })
      } else {
        setMsg({ kind: 'ok', text: `Recorded. Status: ${data.status}.` })
        router.refresh()
      }
    } catch {
      setMsg({ kind: 'err', text: 'Action failed. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  if (readOnly) {
    return (
      <div className="bv-notice">
        Your trial is read-only. Reviewer actions cannot be recorded until the trial is converted.
      </div>
    )
  }

  return (
    <div>
      <div className="bv-ellona-actions">
        <button disabled={busy !== null} onClick={() => act('RELEVANT')}>
          Mark relevant
        </button>
        <button disabled={busy !== null} onClick={() => act('NOT_RELEVANT')}>
          Not relevant
        </button>
        <button
          disabled={busy !== null}
          className={following ? 'is-active' : ''}
          onClick={() => act(following ? 'UNFOLLOW' : 'FOLLOW')}
        >
          {following ? 'Following ✓ (unfollow)' : 'Follow'}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => {
            const detail = window.prompt('What should BioVeracity investigate or verify about this opportunity?')
            if (detail && detail.trim()) act('INVESTIGATION_REQUEST', detail.trim())
          }}
        >
          Request investigation
        </button>
      </div>
      <div className="bv-ellona-actions">
        {(['BID', 'PARTNER', 'MONITOR', 'PASS', 'UNSURE'] as const).map((d) => (
          <button key={d} disabled={busy !== null} onClick={() => act('DECISION', `Decision: ${d}`)}>
            Record decision: {d === 'UNSURE' ? 'Not sure yet' : d.charAt(0) + d.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {msg ? (
        <div className={`bv-notice ${msg.kind === 'err' ? 'bv-danger' : 'bv-ok'}`}>{msg.text}</div>
      ) : null}
    </div>
  )
}
