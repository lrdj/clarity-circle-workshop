# Jekyll GOV.UK Prototype (GitHub Pages friendly)

This repo is a zero‑Node, Jekyll‑only take on the GOV.UK Prototype Kit. It vendors the compiled GOV.UK Frontend CSS/JS/fonts/images and serves them as plain static files, so everything builds on GitHub Pages with a simple push to `main`.

- No npm, no bundlers needed for consumers of this repo
- All GOV.UK Design System components work via the compiled assets
- Pages are plain Jekyll with lightweight layouts and includes


## Quick Start

- Prereqs: Ruby + Bundler installed
- Install and run:
  - `bundle install`
  - `bundle exec jekyll serve`
- Visit: `http://localhost:4000/circle/` (because `_config.yml` sets `baseurl: "/circle"`)

Example pages:
- `gov.md` → `/circle/gov/` (component test page)
- `land_a.html` → `/circle/land_a.html`
- `probs.html` → `/circle/probs.html`

Deploy on GitHub Pages by pushing to `main`. The `github-pages` gem handles the build.


## How It Works

- Static assets: Precompiled GOV.UK Frontend distributed files live under `assets/govuk/` (CSS, JS, fonts, images, component assets). No runtime compilation.
- Jekyll layouts: Use `_layouts/unbranded.html` for GOV.UK‑styled content pages. It pulls in the head, header, footer, and scripts.
- CSS: `_includes/head.html` links `assets/govuk/govuk-frontend.min.css` and adds small inline overrides (e.g., button colour, a simple hero layout). Sass support is configured but not actively used.
- JS initialisation: `_includes/govuk-scripts.html` loads `assets/govuk-prototype-kit/init.js` as a module. That file imports GOV.UK Frontend and calls `initAll()` so components with `data-module="govuk-*"` Just Work.
- Base URL: `_config.yml` sets `baseurl: "/circle"`. All asset links use `{{ site.baseurl }}` so the site works under a subpath on Pages.


## Project Structure

- `_layouts/`
  - `unbranded.html`: Minimal frame for prototype pages
  - `default.html`, `home.html`, `page.html`, `post.html`: Jekyll/minima‑like variants
- `_includes/`
  - `head.html`: CSS link, font faces, small CSS overrides
  - `govuk-scripts.html`: Loads JS and runs `GOVUKFrontend.initAll()`
  - `above-main.html`: Simple white header with logo
  - `footer.html`: GOV.UK‑style footer
- `assets/`
  - `govuk/`: Prebuilt GOV.UK Frontend CSS/JS plus component assets (vendored)
  - `govuk-prototype-kit/init.js`: Bridges module import and exposes `window.GOVUKFrontend` before calling `initAll()`
  - `i/`: Site images
  - `main.scss`: Placeholder (Sass not used right now)
- Pages: `gov.md`, `land_a.html`, `probs.html`, `404.html`


## Adding a Page

Create a file with front matter and use the `unbranded` layout:

```
---
layout: unbranded
title: My GOV.UK page
permalink: /my-page/
---

<h1 class="govuk-heading-xl">Hello</h1>
<p class="govuk-body">Component classes and data-module attributes work out of the box.</p>
```

Ensure any asset links include `{{ site.baseurl }}`:

```
<img src="{{ site.baseurl }}/assets/i/calm.jpg" alt="...">
```


## JS Options (and the “which file do I include?” question)

GOV.UK Frontend publishes multiple JS builds. This repo vendors several, and `_includes/govuk-scripts.html` shows three ways to wire them up:

1) Simple bundle with global (no modules)

```
<script src="{{ site.baseurl }}/assets/govuk/govuk-frontend.bundle.js"></script>
<script>window.GOVUKFrontend.initAll();</script>
```

2) ES module import directly

```
<script type="module" src="{{ site.baseurl }}/assets/govuk/govuk-frontend.min.js"></script>
<script type="module">
  import { initAll } from '{{ site.baseurl }}/assets/govuk/govuk-frontend.min.js';
  initAll();
  </script>
```

3) Current approach (compat shim + init)

```
<script type="module" src="{{ site.baseurl }}/assets/govuk-prototype-kit/init.js"></script>
```

The shim imports the module build, adds `window.GOVUKFrontend` for legacy patterns, and calls `initAll()` when the DOM is ready. This avoids a bundler and works in modern browsers.

If you ever see a “funky” file that looks like source rather than a compiled bundle, you probably picked an internal module entry (e.g., `index.mjs`) or a file expecting a bundler. Use the distributed files from GOV.UK Frontend’s `dist/govuk/` folder instead (see next section).


## Updating GOV.UK Frontend (CSS/JS/fonts)

The vendored files in `assets/govuk/` come from the `dist/govuk` directory of the `govuk-frontend` package. You can refresh them in two common ways:

- Option A: From a temporary npm install (outside this repo)
  - In a throwaway folder: `npm i govuk-frontend@<version>`
  - Copy everything from `node_modules/govuk-frontend/dist/govuk/` into this repo’s `assets/govuk/`
  - Commit the updated assets

- Option B: From GitHub release artifacts
  - Download the release zip/tarball for `govuk-frontend`
  - Extract the `dist/govuk/` folder and copy contents to `assets/govuk/`

Notes:
- Sourcemaps (`.map`) are optional. They’re safe to copy or omit, but not required at runtime.
- If you switch how JS is loaded, also update `_includes/govuk-scripts.html` accordingly.
- After updating, run the site locally, visit `/circle/gov/`, and click through components to sanity‑check `initAll()`.

### Update Checklist (quick)

1) Refresh assets
- Option A: `npm i govuk-frontend@<version>` in a temp folder, then copy `node_modules/govuk-frontend/dist/govuk/*` → `assets/govuk/`
- Option B: Download the release archive and copy `dist/govuk/` → `assets/govuk/`

2) Record the version
- Update or create `assets/govuk/VERSION.txt` (e.g., `5.13.0`).

3) Verify CSS/JS load
- CSS: `_includes/head.html` should link `assets/govuk/govuk-frontend.fixed.css` (Liquid wrapper rewrites font paths for `baseurl`).
- JS: `assets/govuk-prototype-kit/init.js` imports `govuk-frontend.min.js` and calls `initAll()`.

4) Run and sanity-check
- `bundle exec jekyll serve`
- Visit `/circle/gov/` and `/circle/demos/` and test interactions.
- Confirm fonts load (no 404s): URLs should start with `/circle/assets/govuk/assets/fonts/`.

5) Commit and deploy
- Push to `main` so GitHub Pages rebuilds.


## Asset path fix (fonts under baseurl)

GOV.UK Frontend’s compiled CSS uses absolute font URLs like `/assets/fonts/...`. When the site is hosted under a subpath (for example `/circle` on GitHub Pages), those absolute URLs point to the domain root and 404.

This repo ships a tiny Jekyll‑processed wrapper that rewrites those URLs at build time:

- File: `assets/govuk/govuk-frontend.fixed.css`
- Mechanism: Liquid reads `govuk-frontend.min.css` and replaces `/assets/fonts/` with `{{ site.baseurl }}/assets/govuk/assets/fonts/`
- Usage: `_includes/head.html` links to the fixed CSS instead of the raw CSS

Result: Fonts resolve correctly under any `baseurl` without introducing a Node build.

Future updates: No extra work required. When you refresh `assets/govuk/` to a newer version, the wrapper continues to apply the same replacement. If the upstream font path pattern ever changes, adjust the one `replace` rule in `govuk-frontend.fixed.css`.


## Customising Styles

Right now, small overrides live inline in `_includes/head.html`. You can move them into `assets/main.scss` if you prefer:

- Keep the front matter in `assets/main.scss` so Jekyll processes it
- Import any additional partials you add under `assets/`
- Link the compiled CSS from your layout instead of relying on inline styles

Jekyll’s `_config.yml` already sets Sass `load_paths: [assets/govuk]`, which is useful if you decide to author custom Sass later.


## Known Limitations

- No Nunjucks/macros: Jekyll doesn’t process GOV.UK Nunjucks macros. Use HTML + classes and `data-module` attributes directly, as in `gov.md`.
- No Node toolchain: Great for Pages, but you won’t get JS bundling, Autoprefixer, or Sass compilation of GOV.UK sources. Use the prebuilt `dist` assets.
- `baseurl` required: The site assumes a subpath (`/circle`). Update `_config.yml` if you need root hosting and adjust links accordingly.


## License

See `LICENSE.txt`.


## Release Notes

- 2025-02: Updated GOV.UK Frontend to `v5.13.0`; added `assets/govuk/VERSION.txt` marker. Introduced `assets/govuk/govuk-frontend.fixed.css` to rewrite absolute font paths for `baseurl` hosting. Added `/demos/` page that previews component templates with `initAll({ scope })`. Moved inline styles into `assets/main.scss`. Added index page and header Home link.
