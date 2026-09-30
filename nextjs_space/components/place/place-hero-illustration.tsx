// Place hero illustration (Gate F X1). PRESENTATION ONLY: a deterministic,
// hand-authored scene (layered hills, estuary, birds, reeds) that sets the mood
// of a wetland place. It depicts nothing that was recorded, carries no evidence
// relationship and is never read by any evidence path. Place-neutral: it holds
// no Place name, coordinates or data. Rendered server-side as inline SVG, so it
// costs no request and no client JavaScript. The reed field comes from a fixed
// seed, so every render is byte-identical.

export const PLACE_HERO_ILLUSTRATION_VERSION = 'wetland-layers-v1'

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

function reedField() {
  const r = seeded(20260929)
  const back: string[] = []
  const front: string[] = []
  const heads: string[] = []
  for (let i = 0; i < 150; i++) {
    const x = Math.round(r() * 1640 - 20)
    const nearer = i % 3 === 0
    const base = 1000
    const top = Math.round((nearer ? 740 : 790) + r() * (nearer ? 120 : 110))
    const lean = Math.round((r() - 0.5) * 60)
    const d = `M${x} ${base}Q${x + Math.round(lean / 3)} ${Math.round((base + top) / 2)} ${x + lean} ${top}`
    ;(nearer ? front : back).push(d)
    if (r() < 0.32) heads.push(`M${x + lean} ${top + 4}v26`)
  }
  return { back: back.join(''), front: front.join(''), heads: heads.join('') }
}

const REEDS = reedField()
const BIRD = (x: number, y: number, s: number) => `M${x} ${y}q${5 * s} ${-6 * s} ${10 * s} 0q${5 * s} ${-6 * s} ${10 * s} 0`
const FLOCK = [
  [620, 330, 1.3], [660, 312, 1.4], [700, 296, 1.5], [745, 312, 1.3], [790, 330, 1.3], [830, 350, 1.2],
  [585, 352, 1.2], [870, 372, 1.1], [560, 376, 1.1], [1110, 250, 0.9], [1150, 266, 0.8], [470, 270, 0.8],
].map(([x, y, s]) => BIRD(x, y, s)).join('')

export function PlaceHeroIllustration({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label={label}
      focusable="false"
      className="absolute inset-0 h-full w-full"
      data-hero-illustration={PLACE_HERO_ILLUSTRATION_VERSION}
      data-presentation-only=""
    >
      <defs>
        <linearGradient id="pah-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#223A43" />
          <stop offset=".38" stopColor="#4F6874" />
          <stop offset=".74" stopColor="#9C9E90" />
          <stop offset="1" stopColor="#E9D6A0" />
        </linearGradient>
        <radialGradient id="pah-sun" cx="1160" cy="500" r="420" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F6E2A6" stopOpacity=".85" />
          <stop offset="1" stopColor="#F6E2A6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pah-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B9B6A2" />
          <stop offset="1" stopColor="#8E968C" />
        </linearGradient>
        <linearGradient id="pah-land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5E7550" />
          <stop offset=".45" stopColor="#35533A" />
          <stop offset="1" stopColor="#15291E" />
        </linearGradient>
        <linearGradient id="pah-scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1C15" stopOpacity=".55" />
          <stop offset=".16" stopColor="#0B1C15" stopOpacity=".3" />
          <stop offset=".42" stopColor="#0B1C15" stopOpacity=".35" />
          <stop offset=".62" stopColor="#0B1C15" stopOpacity=".62" />
          <stop offset="1" stopColor="#0B1C15" stopOpacity=".88" />
        </linearGradient>
        <linearGradient id="pah-scrim-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0B1C15" stopOpacity=".45" />
          <stop offset=".55" stopColor="#0B1C15" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="560" fill="url(#pah-sky)" />
      <rect width="1600" height="560" fill="url(#pah-sun)" />
      <g fill="#FFFFFF" opacity=".13">
        <ellipse cx="380" cy="170" rx="330" ry="22" />
        <ellipse cx="1080" cy="130" rx="420" ry="18" />
        <ellipse cx="820" cy="220" rx="300" ry="14" />
        <ellipse cx="1400" cy="250" rx="240" ry="12" />
      </g>
      <path fill="#6F6E8E" d="M0 430C160 380 250 330 380 322S560 262 700 250 880 300 1000 330 1180 300 1300 318 1500 372 1600 380V560H0Z" />
      <path fill="#575C7E" d="M0 470C120 440 230 398 360 404S560 440 690 420 900 380 1040 410 1300 450 1600 430V560H0Z" />
      <path fill="#454C6A" d="M0 520C140 490 250 470 380 486S600 520 760 516 1100 500 1250 506 1480 490 1600 480V575H0Z" />
      <path fill={`url(#pah-water)`} d="M0 540H1600V720H0Z" />
      <g fill="#F4EBCF" opacity=".32">
        <rect x="860" y="566" width="420" height="4" rx="2" />
        <rect x="980" y="590" width="300" height="3" rx="1.5" />
        <rect x="760" y="612" width="360" height="3" rx="1.5" />
        <rect x="1060" y="636" width="260" height="3" rx="1.5" />
        <rect x="300" y="600" width="220" height="3" rx="1.5" />
      </g>
      <path fill="#8FAAB8" d="M1600 640C1400 628 1260 668 1080 664S780 640 620 676 300 700 0 690V726H1600Z" />
      <path fill={`url(#pah-land)`} d="M0 700C220 686 420 710 640 702S1000 680 1240 692 1460 704 1600 696V1000H0Z" />
      <g fill="#DCE3DB" opacity=".45">
        <ellipse cx="1080" cy="790" rx="120" ry="10" />
        <ellipse cx="1360" cy="818" rx="90" ry="8" />
      </g>
      <g stroke="#1F2B25" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d={FLOCK} strokeWidth="3.2" />
      </g>
      <g fill="#1F2B25">
        <path d="M1128 650c10-12 30-12 38 0l12-4-8 8c-6 8-26 10-40 4Zm22 8v14m10-14v14" stroke="#1F2B25" strokeWidth="2" />
        <path d="M1188 656c9-11 27-11 34 0l11-3-7 7c-6 7-24 9-36 3Zm20 7v13m9-13v13" stroke="#1F2B25" strokeWidth="2" />
      </g>
      <g fill="none" strokeLinecap="round">
        <path d={REEDS.back} stroke="#2F4E36" strokeWidth="3" />
        <path d={REEDS.front} stroke="#1B3325" strokeWidth="4" />
        <path d={REEDS.heads} stroke="#A7803A" strokeWidth="7" />
      </g>
      <rect width="1600" height="1000" fill="url(#pah-scrim)" />
      <rect width="1600" height="1000" fill="url(#pah-scrim-side)" />
    </svg>
  )
}
