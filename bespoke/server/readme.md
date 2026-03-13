# bespoke/server

A development server for working on bespoke data viz projects locally.

## Usage

```bash
cd bespoke/server
npx tsx devServer.ts
```

The server starts on port **8089** (override with the `PORT` env var).

## How it works

The dev server is a reverse proxy that lazily spawns a [Vite](https://vite.dev/) dev server for each project on first request:

1. A request to `/<project>/*` triggers a Vite process for that project (if not already running)
2. All HTTP requests are proxied to the project's Vite instance
3. WebSocket upgrades (for Vite HMR) are proxied at the TCP level, so hot reload works out of the box

### Demo page

Visiting `/<project>/demo` serves a shared demo page (`component-demo.html`) that:

- Imports the project's `VARIANTS` list
- Mounts each variant inside its own Shadow DOM using `mountBespokeComponentInShadow` from `bespoke/shared`
- This mirrors the production embedding behavior, where each component instance runs in an isolated shadow root

### Entrypoint redirects

The demo page requests `/<project>/index.js` and `/<project>/index.css`. The dev server reads the `entrypoints` field from each project's `package.json` and redirects these to the actual source files so Vite can serve them:

```json
{
    "entrypoints": {
        "js": "src/index.ts",
        "css": "src/styles.css"
    }
}
```

## Files

- **devServer.ts** — The dev server itself
- **component-demo.html** — HTML template for the `/<project>/demo` page, with `{{PROJECT}}` and `{{SHARED_DIR}}` placeholders replaced at serve time
