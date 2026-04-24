# Windy Playground

Serverless browser playground: the `windy` Rust crate compiled to
WebAssembly runs Windy source entirely in the page. No backend, no
network round-trips after the initial asset load.

## Build

From the repository root:

```bash
wasm-pack build --target web --release --out-dir web/pkg
```

This produces `web/pkg/{windy.js, windy_bg.wasm, ...}`, the ES-module
bundle the HTML loads.

## Serve locally

```bash
python3 -m http.server -d web 8000
# then open http://localhost:8000
```

Any static server will do — there is no build or runtime JavaScript
dependency beyond the generated `pkg/`.

## Deploy

The `web/` directory is self-contained: copy it (after building
`web/pkg/`) to any static host. GitHub Pages from `web/` works once
the build artifact lives on the deployed branch.

## Files

- `index.html` — layout
- `style.css` — styles (light + dark via `prefers-color-scheme`)
- `main.js` — editor wiring, example picker, calls into the wasm
- `pkg/` — built wasm (gitignored; produced by `wasm-pack`)
