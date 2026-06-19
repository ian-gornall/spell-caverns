# Self-hosted fonts

## Atkinson Hyperlegible (`atkinson-hyperlegible-400.woff2`, `-700.woff2`)

- **Why:** the UI/spelling typeface. Purpose-built by the Braille Institute to maximize
  letter *distinction* (I/l/1, 0/O, b/d/p/q) — exactly the property a spelling task needs.
  See `DESIGN_ANALYSIS.md` §2.2 / rec #3.
- **Source:** Google Fonts (`fonts.gstatic.com/.../atkinsonhyperlegible/v12`), the **latin**
  subset only (this is an English app), normal weights 400 + 700. ~17 KB each.
- **License:** SIL Open Font License 1.1 — free to bundle/self-host commercially. Full text
  in `OFL.txt`. Copyright 2020 Braille Institute of America, Inc.

Self-hosted (not loaded from a CDN) so the PWA stays offline-capable and dependency-free;
the woff2 are precached in `sw.js` CORE. The big decorative home title keeps **Baloo 2**.
