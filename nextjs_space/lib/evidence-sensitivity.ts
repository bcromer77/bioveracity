// Content-level sensitivity screening (biodiversity control #7).
//
// A database label is not enough: precise localities for sensitive species can
// hide inside passage text, coordinates, links, filenames and image metadata.
// This screen inspects the actual content and reports whether it can be treated
// as a generalised public representation, independent of any incoming label.
//
// It is deliberately conservative and pattern-based. It flags precise locality
// signals so a record cannot be classified PUBLIC while still carrying them.
// Full EXIF/image parsing is out of scope here (documented as proposed).

export type SensitivityFinding = { kind: string; detail: string }
export type SensitivityScan = { sensitive: boolean; findings: SensitivityFinding[] }

// Decimal degrees with 4+ fractional digits (~<=11 m) is a precise fix.
const DECIMAL_COORD = /-?\b\d{1,3}\.\d{4,}\s*[,\/]\s*-?\d{1,3}\.\d{4,}\b/
// British/Irish National Grid reference: 1-2 letters then 6-10 digits (>=6 => <=100 m).
const GRID_REF = /\b[HJNOST][A-Z]\s?\d{3}\s?\d{3,5}\b/
const IRISH_GRID = /\b[A-HJ-Z]\s?\d{3}\s?\d{3,5}\b/
// Image geolocation metadata markers.
const EXIF_GPS = /\b(gpslatitude|gpslongitude|gpsposition|geotag|exif:gps|\bgps\s?coordinates)\b/i
// Image/attachment filenames that may carry embedded metadata.
const IMAGE_FILE = /[\w-]+\.(jpe?g|tiff?|heic|png|raw|cr2|nef)\b/i
// Words that commonly accompany precise, protected localities.
const PRECISE_LOCALITY = /\b(nest site|nesting site|badger sett|roost location|breeding site|den location|precise (?:location|grid|coordinates)|exact (?:location|grid|coordinates))\b/i

function scanText(text: string): SensitivityFinding[] {
  const findings: SensitivityFinding[] = []
  if (DECIMAL_COORD.test(text)) findings.push({ kind: 'coordinates', detail: 'Precise decimal coordinates present' })
  if (GRID_REF.test(text) || IRISH_GRID.test(text)) findings.push({ kind: 'grid_reference', detail: 'Precise national grid reference present' })
  if (EXIF_GPS.test(text)) findings.push({ kind: 'image_metadata', detail: 'Image geolocation metadata reference present' })
  if (PRECISE_LOCALITY.test(text)) findings.push({ kind: 'precise_locality', detail: 'Precise protected-locality wording present' })
  return findings
}

function scanLink(url: string): SensitivityFinding[] {
  const findings: SensitivityFinding[] = []
  if (IMAGE_FILE.test(url)) findings.push({ kind: 'image_link', detail: 'Image file link may carry embedded geolocation metadata' })
  findings.push(...scanText(decodeURIComponent(url)))
  return findings
}

type ScanInput = {
  sections?: { locator?: string; text?: string }[]
  links?: (string | null | undefined)[]
  filenames?: (string | null | undefined)[]
  imageMetadata?: (string | null | undefined)[]
  text?: (string | null | undefined)[]
}

// Screen every supplied surface. Returns sensitive=true if any precise-locality
// signal is found, meaning the content is not a safe generalised public form.
export function scanForSensitiveContent(input: ScanInput): SensitivityScan {
  const findings: SensitivityFinding[] = []
  const dedupe = new Set<string>()
  const push = (fs: SensitivityFinding[]) => {
    for (const f of fs) {
      const key = `${f.kind}:${f.detail}`
      if (!dedupe.has(key)) { dedupe.add(key); findings.push(f) }
    }
  }
  for (const s of input.sections ?? []) {
    if (s?.text) push(scanText(String(s.text)))
    if (s?.locator) push(scanText(String(s.locator)))
  }
  for (const t of input.text ?? []) if (t) push(scanText(String(t)))
  for (const link of input.links ?? []) if (link) push(scanLink(String(link)))
  for (const name of input.filenames ?? []) {
    if (!name) continue
    if (IMAGE_FILE.test(String(name))) push([{ kind: 'image_filename', detail: 'Image filename may carry embedded geolocation metadata' }])
    push(scanText(String(name)))
  }
  for (const meta of input.imageMetadata ?? []) if (meta) push(scanText(String(meta)))
  return { sensitive: findings.length > 0, findings }
}

// Convenience: screen a stored evidence document's own content surfaces.
export function scanEvidenceDocument(doc: {
  url?: string | null; title?: string | null
  sections?: { locator?: string; text?: string }[] | unknown
}): SensitivityScan {
  const sections = Array.isArray(doc.sections) ? (doc.sections as { locator?: string; text?: string }[]) : []
  return scanForSensitiveContent({
    sections,
    links: [doc.url ?? undefined],
    text: [doc.title ?? undefined],
  })
}
