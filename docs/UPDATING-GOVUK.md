# Updating GOV.UK Frontend assets

This project vendors the compiled GOV.UK Frontend distribution under `assets/govuk/`. To update to a newer version, replace the contents of that folder with the files from the package’s `dist/govuk/` directory.

## What to copy

From `govuk-frontend` package `dist/govuk/`:
- `govuk-frontend.min.css` (and optionally `.css.map`)
- `govuk-frontend.min.js` (ES module build)
- `govuk-frontend.bundle.js` (IIFE/UMD global build) — optional alternative
- `assets/` (fonts, images, manifest)
- `components/` (component example HTML, README, SCSS, etc.)
- `common/`, `errors/`, `init.mjs` and other module files — shipped for completeness; only some are used

This repo currently uses:
- CSS: `assets/govuk/govuk-frontend.min.css`
- JS: `assets/govuk-prototype-kit/init.js` which imports `assets/govuk/govuk-frontend.min.js` and calls `initAll()`

## Ways to refresh

1) Temporary npm install (outside this repo)
```
mkdir /tmp/govuk-refresh && cd /tmp/govuk-refresh
npm i govuk-frontend@<version>
cp -R node_modules/govuk-frontend/dist/govuk/* /path/to/this/repo/assets/govuk/
```
Commit the changes in this repo.

2) GitHub release archives
- Download the release zip/tarball for `govuk-frontend`
- Extract and copy the `dist/govuk/` contents into `assets/govuk/`

## Which JS should I point to?

GOV.UK Frontend exposes multiple builds:
- `govuk-frontend.bundle.js`: classic script tag, exposes `window.GOVUKFrontend`
- `govuk-frontend.min.js`: ESM build

This repo uses a small shim: `assets/govuk-prototype-kit/init.js` which:
- imports `../govuk/govuk-frontend.min.js`
- sets `window.GOVUKFrontend = GOVUKFrontend` for compatibility
- calls `initAll()` on DOM ready

If you prefer, you can swap to the bundle approach in `_includes/govuk-scripts.html` by uncommenting the relevant block.

## Sourcemaps

`.map` files are optional for runtime. They help debugging locally but are not required for the site to work. Copy them if you want nicer devtools, or omit to save space.

## Sanity checks after update

- Run `bundle exec jekyll serve`
- Load `/circle/gov/` and exercise:
  - Header, service navigation, radios
  - Accordion (ensures `initAll()` is running)
  - Cookie banner focus styles
- Verify fonts and icons load (network tab should show 200s for font files)

## Troubleshooting

- Components not interactive: ensure the JS path matches and `_includes/govuk-scripts.html` is loading a valid build. The `bundle.js` + `window.GOVUKFrontend.initAll()` path is the most foolproof.
- 404s for assets in production: confirm links include `{{ site.baseurl }}` (see `head.html` and example pages).
- Weird ESM import errors: you likely pulled a source entry (`index.mjs`) instead of `dist/govuk/govuk-frontend.min.js`. Replace with the compiled file from `dist`.

