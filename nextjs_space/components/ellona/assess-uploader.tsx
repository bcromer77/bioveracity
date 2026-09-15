'use client'

// Client uploader for the assessment journey. Shows the pre-upload notice, asks
// the decision question, then uploads the file to POST /api/ellona/assessment.
// On success it navigates to the review screen for the new assessment. All
// security (scan, parse timeout, format policy, tenant scope) is enforced
// server-side; this component only collects input and reports the server's
// response honestly.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Decision = { value: string; label: string }

export function AssessUploader({
  notice,
  decisions,
  readOnly,
}: {
  notice: string
  decisions: Decision[]
  readOnly: boolean
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [decision, setDecision] = useState('UNSURE')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (readOnly) {
    return (
      <div className="bv-notice" style={{ marginTop: 20 }}>
        Your trial is currently read-only, so new assessments cannot be created. You can still browse existing
        opportunities and any assessments already in your workspace.
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    setError('')
    if (!file) {
      setError('Choose a document to analyse first.')
      return
    }
    if (!acknowledged) {
      setError('Please confirm you are uploading only public or non-confidential material.')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('decision', decision)
      const res = await fetch('/api/ellona/assessment', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'The document could not be analysed.')
        setBusy(false)
        return
      }
      router.push(`/ellona/assess/${data.id}`)
    } catch {
      setError('The upload failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="bv-ellona-panel" style={{ display: 'block', marginTop: 20 }}>
      <div className="bv-notice">{notice}</div>

      <label className="bv-field-label" style={{ marginTop: 18 }} htmlFor="decision">
        What are you trying to decide?
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {decisions.map((d) => (
          <label
            key={d.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '2px solid',
              borderColor: decision === d.value ? '#173d35' : '#d8d4c4',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="decision"
              value={d.value}
              checked={decision === d.value}
              onChange={() => setDecision(d.value)}
            />
            {d.label}
          </label>
        ))}
      </div>

      <label className="bv-field-label" style={{ marginTop: 18 }} htmlFor="file">
        Opportunity document (PDF, DOCX, EML, TXT or CSV, up to 3 MB)
      </label>
      <input
        id="file"
        type="file"
        accept=".pdf,.docx,.eml,.txt,.csv"
        onChange={(e: any) => setFile(e?.target?.files?.[0] ?? null)}
        style={{ marginTop: 8, display: 'block' }}
      />

      <label style={{ display: 'flex', gap: 10, marginTop: 18, fontSize: 14, alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e: any) => setAcknowledged(!!e?.target?.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          I confirm this document is public or non-confidential and does not contain personal or commercially
          sensitive information.
        </span>
      </label>

      {error && (
        <div className="bv-danger" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button type="submit" className="bv-button bv-green" disabled={busy} style={{ marginTop: 18 }}>
        {busy ? 'Reading the document…' : 'Analyse this opportunity'}
      </button>
      <p style={{ marginTop: 12, fontSize: 13, color: '#5b6157' }}>
        The document is scanned for malware and read within a strict time limit. It is stored encrypted inside your
        workspace and is never published or shared.
      </p>
    </form>
  )
}
