# BioVeracity web fonts

These unchanged Google Fonts WOFF2 files were recovered from an earlier successful BioVeracity Next.js build. The family, weight and Unicode ranges come from that build’s generated @font-face rules. The binary files are unchanged, with SHA-256 checksums in manifest.json. Original family licences are included beside the fonts, retrieved from the official google/fonts repository on 22 September 2026.

- DM Sans: https://github.com/google/fonts/tree/main/ofl/dmsans
- Plus Jakarta Sans: https://github.com/google/fonts/tree/main/ofl/plusjakartasans
- JetBrains Mono: https://github.com/google/fonts/tree/main/ofl/jetbrainsmono

app/fonts.css preserves all previously emitted language subsets, variable weight ranges, swap display and fallback metrics. The root layout preloads only the three Latin files, matching the former latin subset preload. Font styles were normal before this change and remain normal; browsers handle italics as before.

Fonts are now served by BioVeracity. Neither build nor browser needs Google font servers. These assets are independent of the DejaVu fonts used by document/PDF generation. Retain the OFL notices with every redistribution. Future font updates must replace assets and their manifest together, preserve licence terms and check layout.
