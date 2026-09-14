/** Ireland-only, globally anchored projected search grid. Sizes are projected
 * side lengths, not equal ground areas or surveyed ecological boundaries.
 * Coordinates use a fixed equirectangular projection; changing it requires v2.
 */
export type Point = { lat: number; lng: number }
export type Cell = { id: string; q: number; r: number; size: number; center: Point; ring: Point[] }
const R = 6371000,
  RAD = Math.PI / 180,
  COS = Math.cos(53.5 * RAD)
const SIZES = [500, 1000, 2000]
const VERSION = 'iehex1'
const project = (p: Point) => ({ x: R * COS * (p.lng + 8) * RAD, y: R * (p.lat - 53.5) * RAD })
const inverse = (x: number, y: number): Point => ({ lat: y / (R * RAD) + 53.5, lng: x / (R * COS * RAD) - 8 })
function sizeCheck(size: number) {
  if (!SIZES.includes(size)) throw new Error('Cell side length must be 500, 1000 or 2000 projected metres')
}
function pointCheck(p: Point) {
  if (
    !p ||
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lng) ||
    p.lat < 51 ||
    p.lat > 56 ||
    p.lng < -11 ||
    p.lng > -5
  )
    throw new Error('Search coordinates must be inside the Ireland grid (51–56 latitude, −11–−5 longitude)')
}
function makeCell(q: number, r: number, size: number): Cell {
  sizeCheck(size)
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) throw new Error('Invalid cell coordinates')
  const x = size * Math.sqrt(3) * (q + r / 2),
    y = size * 1.5 * r
  const center = inverse(x, y)
  // A one-side-length fringe permits cells whose centres are just outside the
  // input domain but which own points on its edge. It also bounds hostile IDs.
  const sw = project({ lat: 51, lng: -11 }),
    ne = project({ lat: 56, lng: -5 })
  if (x < sw.x - size || x > ne.x + size || y < sw.y - size || y > ne.y + size)
    throw new Error('Cell outside Ireland grid')
  const ring = Array.from({ length: 6 }, (_, k) => {
    // Clockwise outer ring is compatible with ArcGIS polygon queries.
    const theta = (30 - 60 * k) * RAD
    return inverse(x + size * Math.cos(theta), y + size * Math.sin(theta))
  })
  ring.push({ ...ring[0] })
  return { id: `${VERSION}:${size}:${q}:${r}`, q, r, size, center, ring }
}
export function cellAt(point: Point, size = 1000): Cell {
  pointCheck(point)
  sizeCheck(size)
  const { x, y } = project(point)
  // Deterministic nearest-centre selection, with lexicographic ties. Evaluate
  // nearby axial lattice points rather than relying on floating cube-round ties.
  const fq = x / (Math.sqrt(3) * size) - y / (3 * size),
    fr = (2 * y) / (3 * size)
  let bestQ = 0,
    bestR = 0,
    best = Infinity
  for (let q = Math.floor(fq) - 1; q <= Math.floor(fq) + 2; q++) {
    for (let r = Math.floor(fr) - 1; r <= Math.floor(fr) + 2; r++) {
      const dx = x / size - Math.sqrt(3) * (q + r / 2),
        dy = y / size - 1.5 * r
      const d = dx * dx + dy * dy
      // Dimensionless tolerance absorbs geographic roundtrip error at edges.
      if (d < best - 1e-10) {
        best = d
        bestQ = q
        bestR = r
      }
    }
  }
  return makeCell(bestQ, bestR, size)
}
export function cellFromId(id: string): Cell {
  if (typeof id !== 'string' || id.length > 60) throw new Error('Invalid cell ID')
  const match = /^iehex1:(500|1000|2000):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*))$/.exec(id)
  if (!match) throw new Error('Invalid cell ID')
  const cell = makeCell(Number(match[2]), Number(match[3]), Number(match[1]))
  if (cell.id !== id) throw new Error('Noncanonical cell ID')
  return cell
}
export function neighbours(cell: Cell, radius = 2): Cell[] {
  const canonical = cellFromId(cell.id)
  if (!Number.isInteger(radius) || radius < 0 || radius > 5)
    throw new Error('Neighbour radius must be between 0 and 5')
  const result: Cell[] = []
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      try {
        result.push(makeCell(canonical.q + dq, canonical.r + dr, canonical.size))
      } catch {
        /* clipped at domain fringe */
      }
    }
  }
  return result
}
/** Single deterministic ownership, including shared polygon edges. */
export function pointInCell(point: Point, cell: Cell): boolean {
  const canonical = cellFromId(cell.id)
  try {
    return cellAt(point, canonical.size).id === canonical.id
  } catch {
    return false
  }
}
export function cellsBounds(cells: Cell[]): { west: number; south: number; east: number; north: number } {
  if (!cells.length) throw new Error('At least one cell is required')
  const points = cells.flatMap((c) => cellFromId(c.id).ring)
  return {
    west: Math.min(...points.map((p) => p.lng)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    north: Math.max(...points.map((p) => p.lat))
  }
}
