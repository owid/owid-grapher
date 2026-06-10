# bespoke/server

A development server for working on bespoke data viz projects locally.

## Usage

```bash
yarn startBespokeDevServer
```

The server starts on port **8089** (override with the `PORT` env var). It's also included in `make up.full`.

## How it works

The dev server is a reverse proxy that lazily spawns a [Vite](https://vite.dev/) dev server for each project on first request:

1. A request to `/<project>/*` triggers a Vite process for that project (if not already running)
2. All HTTP requests are proxied to the project's Vite instance
3. WebSocket upgrades (for Vite HMR) are proxied at the TCP level, so hot reload works out of the box

A separate shared Vite dev server handles demo infrastructure files (CSS, shared TS helpers from `bespoke/shared/`) under the `/__bespoke/` path prefix. This runs in dev mode regardless of whether projects use build mode, so TypeScript is always transformed on the fly.

### Build mode

Pass `--build` to build each project before serving it via `vite preview` instead of `vite dev`:

```bash
yarn startBespokeDevServer --build
```

In build mode, the demo page uses the built output files (`index.js`, `index.css`) instead of source entrypoints. The `/__bespoke/` Vite instance still runs in dev mode to serve the demo infrastructure.

### Demo page

Visiting `/<project>/demo` serves a demo page that imports the project's `VARIANTS` list and mounts each variant inside its own Shadow DOM using `mountBespokeComponentInShadow` from `bespoke/shared`. This mirrors the production embedding behavior.

### Entrypoints

The demo page reads the `entrypoints` field from each project's `package.json` to know which source files to load:

```json
{
    "entrypoints": {
        "js": "src/index.ts",
        "css": "src/index.css" // optional
    }
}
```

Only `js` is required. If `css` is omitted, the demo page won't load a separate stylesheet — useful when your component injects its own styles via `vite-plugin-css-position`, which is recommended.

In dev mode, requests for `/<project>/index.js` and `/<project>/index.css` are redirected to the corresponding source entrypoints so Vite can serve them. In build mode, these files exist as-is in the build output.

## Files

- **devServer.ts** — The dev server itself
- **component-demo.html** — Demo page template (mounts variants inside Shadow DOM)
- **component-demo.css** / **demo-grid.css** — Styles for the demo page, served via the `/__bespoke/` Vite instance
