'use client'
import { useRef, useState } from 'react'

// “What did you notice?” A visitor's contribution is a community observation, not
// a verification. We never ask for a name, and never for map coordinates — only
// a rough area in words, and only if they wish. Nothing shared here is published
// until the venue chooses to publish it.

// Mirrors CONTRIBUTION_CATEGORIES in lib/wild-hubs/contributions.ts (kept inline
// so this client component pulls in no server-only code). The server re-validates.
const CATEGORIES = [
  { value: 'bird', label: 'Bird' },
  { value: 'mammal', label: 'Mammal' },
  { value: 'insect', label: 'Insect' },
  { value: 'plant', label: 'Plant' },
  { value: 'fungi', label: 'Fungi' },
  { value: 'farm-animal', label: 'Farm animal' },
  { value: 'water', label: 'Water' },
  { value: 'sky', label: 'Sky' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: "I don't know" },
]

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Could not read that photo.'))
    r.onload = () => {
      const s = String(r.result)
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    r.readAsDataURL(file)
  })

export function ContributeForm({ hubId }: { hubId: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const form = e.currentTarget
    const data = new FormData(form)
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Please add one photograph of what you noticed.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Please choose a JPEG or PNG up to 3 MB.')
      return
    }
    setBusy(true)
    try {
      const base64 = await readAsBase64(file)
      const res = await fetch('/api/wild/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubId,
          base64,
          broadCategory: data.get('broadCategory') || 'unknown',
          whatYouThink: (data.get('whatYouThink') as string) || '',
          note: (data.get('note') as string) || '',
          coarseLocation: (data.get('coarseLocation') as string) || '',
          observedAt: (data.get('observedAt') as string) || '',
          permissionToPublish: data.get('permissionToPublish') === 'on',
          rightsConfirmed: data.get('rightsConfirmed') === 'on',
          scannerConsent: data.get('scannerConsent') === 'on',
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'That could not be shared just now.')
      }
      setDone(true)
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <section className="bv-section bv-contribute">
        <div className="bv-success">
          <p className="bv-eyebrow">Thank you</p>
          <h3>That’s now with the woods.</h3>
          <p>
            What you noticed has been shared privately with the venue. Nothing
            appears publicly unless they choose to include it — and it stays your
            observation, always.
          </p>
        </div>
      </section>
    )

  return (
    <section className="bv-section bv-contribute">
      <p className="bv-eyebrow">Seen something?</p>
      <h2>What did you notice?</h2>
      <p>
        Add one photograph and, if you like, a few words. You don’t need to know
        what it was. Every sighting is welcome, and nothing is shared publicly
        without the venue’s say-so.
      </p>
      {!open ? (
        <button type="button" className="bv-button bv-green" onClick={() => setOpen(true)}>
          Share what you noticed
        </button>
      ) : (
        <form className="bv-form bv-contribute-form" onSubmit={onSubmit}>
          <label>
            A photograph
            <input ref={fileRef} type="file" name="photo" accept="image/jpeg,image/png" required />
          </label>
          <label>
            What do you think you saw?
            <input type="text" name="whatYouThink" maxLength={300} placeholder="e.g. a small brown bird — or leave blank" />
          </label>
          <label>
            Which best describes it?
            <select name="broadCategory" defaultValue="unknown">
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            When did you see it?
            <input type="date" name="observedAt" />
          </label>
          <label>
            Roughly where? (in words)
            <input type="text" name="coarseLocation" maxLength={200} placeholder="e.g. near the old oak by the path" />
          </label>
          <label>
            Anything else? (private note to the venue)
            <textarea name="note" maxLength={2000} rows={3} />
          </label>
          <label className="bv-check">
            <input type="checkbox" name="rightsConfirmed" required />
            <span>This photograph is mine to share.</span>
          </label>
          <label className="bv-check">
            <input type="checkbox" name="scannerConsent" required />
            <span>I’m happy for it to be safely checked before it’s stored.</span>
          </label>
          <label className="bv-check">
            <input type="checkbox" name="permissionToPublish" />
            <span>
              The venue may include this in the public story of the woods. (If you
              leave this unticked, only the venue will see it.)
            </span>
          </label>
          <p className="bv-small">
            Please don’t include anyone’s name or precise location, and take care
            around nests, dens and roosts.
          </p>
          {error && <p className="bv-error" role="alert">{error}</p>}
          <div className="bv-actions">
            <button type="submit" className="bv-button bv-green" disabled={busy}>
              {busy ? 'Sharing…' : 'Share what you noticed'}
            </button>
            <button type="button" className="bv-text-link" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
