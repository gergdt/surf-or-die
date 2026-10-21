# Surf or Die performance baseline

Chunk sizes from `.next/static/chunks` after `next build`.
Gzip is `zlib` gzip (level 9 equivalent via `createGzip()` / Python `gzip.compress`).

Lighthouse mobile runs are deferred to a later workstream (WS6+) along with
Playwright `npm run verify`. This file tracks JS chunk sizes for WS0/WS1.

Measure with:

```bash
npm run build
npm run analyze
```

`ANALYZE=true` is accepted by `npm run analyze` as a no-op flag. `@next/bundle-analyzer`
is not wired because Next 16 production builds use Turbopack, which does not run
the webpack analyzer plugin.

## Baseline (before WS1)

Recorded from the existing production build on `main` after WS0
(`83a1b385a18a2947cfd7a0906869a91c72086c0c`; chunk hashes from the pre-WS1
`.next` output).

Largest JS chunks:

| file | raw | gzip | notes |
| --- | ---: | ---: | --- |
| `1vgbygokarn67.js` | 3,036,977 (2.90 MB) | 335,336 (327 KB) | Inlined `exercises.json` (`JSON.parse('[{"id":"fl_90_90_hip"...`) |
| `2d5wue-hoqiij.js` | 384,673 | 107,900 | |
| `35icv4iilzp4z.js` | 338,820 | 98,863 | |
| `3rg389197tacb.js` | 338,820 | 98,861 | |
| `3n7dm2ojtyzwn.js` | 227,537 | 70,842 | |

- JS chunk files: 28
- Total JS in `.next/static/chunks`: 5,159,258 bytes (~4.92 MB) uncompressed
- Hevy catalog (`hevy-catalog.json`, ~461 KB) was statically imported via
  `lib/hevy/catalog.ts` into the client graph (providers → Hevy sync)

## After WS1

Same machine, `ANALYZE=true npm run build` after moving the exercise seed to
`public/seed/exercises.v33.json` and enriching Hevy templates on the server.

Largest JS chunks:

| file | raw | gzip | notes |
| --- | ---: | ---: | --- |
| `2d5wue-hoqiij.js` | 384,673 (376 KB) | 107,900 | Previously #2; now the largest JS chunk |
| `35icv4iilzp4z.js` | 338,820 | 98,863 | Unchanged vs baseline |
| `3rg389197tacb.js` | 338,820 | 98,861 | Unchanged vs baseline |
| `3n7dm2ojtyzwn.js` | 227,537 | 70,842 | Unchanged vs baseline |
| `1mi20njiqcfld.js` | 150,331 | 40,327 | |

- JS chunk files: 27 (the 2.90 MB `1vgbygokarn67.js` seed chunk is gone)
- Total JS in `.next/static/chunks`: 2,145,136 bytes (~2.05 MB) uncompressed / 634,470 gzip
- No JS chunk exceeds 500 KB uncompressed (acceptance)
- Public seed `public/seed/exercises.v33.json` is 2.9 MB and is **not** a JS chunk
- Client chunks no longer contain `hevy-catalog.json` (catalog matching runs in
  `app/api/hevy/sync` via `lib/hevy/catalog-server.ts`)

Delta vs baseline: **−3.01 MB** uncompressed JS (−2,014,122 bytes, about 61% of
previous chunk total).

## Post-implementation (WS0–WS8 + features 1–12)

Recorded after the integration pass (`npm run build` + `npm run analyze`) on the
combined workstream branch. Seed is still fetched as `/seed/exercises.v33.json`
(`SEED_VERSION = 33`); client chunks contain neither inlined `exercises.json`
nor `hevy-catalog.json`.

Largest JS chunks:

| file | raw | gzip | notes |
| --- | ---: | ---: | --- |
| `2q4r8hh0hd6-x.js` | 382,396 (373 KB) | 108,903 | Largest JS chunk; under 500 KB |
| `1eeokkvrqyp8g.js` | 335,096 | 98,069 | |
| `3h9pe0-cogx63.js` | 335,096 | 98,052 | |
| `3n7dm2ojtyzwn.js` | 227,537 | 71,012 | Unchanged vs WS1 |
| `0e-yl93-u58u_.js` | 154,846 | 45,192 | |

- JS chunk files: 38
- Total JS in `.next/static/chunks`: 2,484,959 bytes (~2.37 MB) uncompressed / 729.2 KB gzip
- No JS chunk exceeds 500 KB uncompressed (acceptance)
- Public seed `public/seed/exercises.v33.json` remains a fetchable asset, not a JS chunk
- Hevy catalog still loads only in `lib/hevy/catalog-server.ts` (`import "server-only"`)

Delta vs After WS1: **+340 KB** uncompressed JS (2.05 MB → 2.37 MB) from added
features (pose overlay, virtualized picker, charts, backup zip, Hevy push). Still
**−2.67 MB** vs the pre-WS1 baseline.
