# River Dodder PlaceExplorer

Status: reference source for review. NOT INTEGRATED into the Next.js app. NOT DEPLOYED. PRODUCTION DATA CHANGED: NO. Enquiry is not sent anywhere.

## What it is

The working River Dodder trust demonstrator. It shows what was knowable on 24 October 2011, what the latest located evidence shows, which comparisons are refused, and which records were not located.

## How to mount later

Only after review, inside the Next app:

```tsx
import { records } from "@/data/record";
import { PlaceExplorer } from "@/components/place-explorer";

<PlaceExplorer place={records.dodder} frame="bare" />
```

There is no `hydrate()` function. `projectPlace()` runs inside `PlaceExplorer`.

- `frame="bare"` hides this demonstrator's own header.
- Keep the sentence "Researched records for one comparison. Not a complete catchment."
- Do not rewrite the evidence.

## Stack

This source is from a TanStack Start + Tailwind v4 workspace. BioVeracity's app is Next.js with Tailwind configured in `nextjs_space/tailwind.config.ts`. Do not upgrade the Next app to Tailwind v4 in order to embed this. Scope the classes in `src/styles.css` under one wrapper before importing them. Global names such as `.hero-grid`, `.stage`, `.btn-solid` and `.panel` will collide.

## Dependencies

Dependencies used by these files: react, zustand, lucide-react. They are not added to `nextjs_space/package.json` in this pull request.

`useDemo` is a single Zustand store. Do not merge it into an existing site store.

`PlaceExplorer` imports `dodderHoney` from `dodder.ts`. This drop is the Dodder record only. Do not generalise it into a multi-river component in the same change.

## Enquiry

"Do this for my place" writes localStorage key `bv-enquiry-demo` with `transmitted: false`. Do not connect it to PR #101.

## Plate and fonts

The Dodder plate is inline SVG in `place-stage.tsx`. Do not copy woodland, wetland or company photographs.

Fonts referenced by the stylesheet: Fraunces and Outfit.

## Known evidence gaps

Preserve these gaps. Do not close them:

- original Met Éireann warning text
- a recent authoritative series at Waldron's Bridge
- a recent OPW flood-event form
- the Phase 3 planning reference
- an adopted council decision
- the definition of quality code 31

The 2011 Waldron's Bridge estimate and the 2026 Anglesea Road level must remain labelled not comparable.
