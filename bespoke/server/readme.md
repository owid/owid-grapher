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

### Demo page

Visiting `/<project>/demo` serves a demo page that imports the project's `VARIANTS` list and mounts each variant inside its own Shadow DOM using `mountBespokeComponentInShadow` from `bespoke/shared`. This mirrors the production embedding behavior.

#### `?shadowDom=false`

Append `?shadowDom=false` to the demo URL (e.g. `/<project>/demo?shadowDom=false`) to mount variants **without** Shadow DOM. This is useful during active development because **CSS HMR only works in this mode**

Both modes are linked from the project listing page at `http://localhost:8089/`.

### Entrypoints

The demo page reads the `entrypoints` field from each project's `package.json` to know which source files to load:

```json
{
    "entrypoints": {
        "js": "src/index.ts",
        "css": "src/index.css"
    }
}
```

## Files

- **devServer.ts** — The dev server itself
- **component-demo.html** — Shadow DOM demo template
- **component-demo-no-shadowdom.html** — No-shadow-DOM demo template (better CSS HMR)
