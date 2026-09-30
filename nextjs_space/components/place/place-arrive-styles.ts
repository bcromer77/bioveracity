// Place ARRIVE design system (Gate F X1). Class tokens reuse the PR D Place
// palette (place-tokens.ts). The CSS below covers what utility classes cannot:
// :target sheets, the sheet entrance motion, reduced motion and the source-link
// touch target. It is a static string with no Place-specific content.

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pl-fuchsia)]'
export const editorial = 'font-[family-name:var(--pl-editorial)]'
export const textLink = `underline decoration-[color:var(--pl-gold)] underline-offset-4 hover:text-[color:var(--pl-green)] ${focusRing}`
export const eyebrow = 'text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--pl-green)]'
export const sectionTitle = `${editorial} text-[28px] leading-tight text-[color:var(--pl-green-deep)] md:text-[34px]`
export const sheetTitle = `${editorial} text-[26px] leading-tight text-[color:var(--pl-green-deep)] md:text-[30px]`
export const card = 'rounded-2xl bg-[color:var(--pl-paper)] shadow-[0_1px_2px_rgba(28,42,34,0.06),0_8px_24px_rgba(28,42,34,0.05)]'
export const section = 'mx-auto max-w-5xl scroll-mt-20 px-5 py-8 md:px-8 md:py-10'
export const target44 = `inline-flex min-h-[44px] items-center rounded-lg ${focusRing}`
// The shared EvidenceLink renders a <button> disclosure for external sources; give it the same 44px target and focus ring.
export const attribution =
  'underline decoration-[color:var(--pl-gold)] underline-offset-4 [&>button]:inline-flex [&>button]:min-h-[44px] [&>button]:items-center [&>button]:rounded-lg [&>button:focus-visible]:outline [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-offset-2 [&>button:focus-visible]:outline-[color:var(--pl-fuchsia)]'

export const PLACE_ARRIVE_CSS = `
.pa-sheet{display:none}
.pa-sheet:target,.pa-sheet:has(:target){display:flex;position:fixed;inset:0;z-index:60;align-items:flex-end;justify-content:center;background:rgba(20,63,44,.46)}
.pa-sheet:focus{outline:none}
.pa-sheet-panel{width:100%;max-width:44rem;max-height:88vh;overflow-y:auto;overscroll-behavior:contain;background:var(--pl-warm);border-radius:24px 24px 0 0;padding:20px 20px calc(28px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(20,63,44,.22);animation:pa-rise .28s cubic-bezier(.2,.7,.2,1)}
@media (min-width:768px){.pa-sheet:target,.pa-sheet:has(:target){align-items:center;padding:24px}.pa-sheet-panel{border-radius:24px;padding:28px 32px}}
@keyframes pa-rise{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
.pa-fade{animation:pa-fade .5s ease-out both}
@keyframes pa-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pa-src a,.pa-src button{min-height:44px;display:inline-flex;align-items:center}
.pa-theme>summary{min-height:44px;display:flex;align-items:center;gap:.5rem;cursor:pointer;list-style:none}
.pa-theme>summary::-webkit-details-marker{display:none}
.pa-theme>summary::after{content:'+';margin-left:auto;font-size:20px;color:var(--pl-green)}
.pa-theme[open]>summary::after{content:'\\2212'}
.pa-chip{background:var(--pl-paper);border-color:var(--pl-line);color:var(--pl-ink);box-shadow:0 1px 2px rgba(28,42,34,.06)}
.pa-chip-off{background:var(--pl-warm);border-style:dashed;color:var(--pl-muted);box-shadow:none}
.pa-chips{scrollbar-width:none}.pa-chips::-webkit-scrollbar{display:none}
.pa-gap{background:repeating-linear-gradient(135deg,#F2EDDF 0 4px,#E5DDC8 4px 7px)}
html[data-bv-consent] [data-place-consent-slot]{display:none}
@media (min-width:1024px){.pa-chips .pa-chip{background:rgba(18,37,28,.78);border-color:rgba(255,255,255,.3);color:#fff;box-shadow:none}.pa-chips .pa-chip>span:first-child{background:rgba(255,255,255,.92)}}
@media (prefers-reduced-motion:reduce){.pa,.pa *,.pa *::before,.pa *::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}}
`
