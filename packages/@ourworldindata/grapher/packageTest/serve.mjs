// Zero-dependency static file server for the demo pages in this package.
//
// Serves the package root so demo.html / core-econ-demo.html load the dist/
// artifacts exactly as a CDN consumer would — no bundler transforms in
// between. Run with `yarn startDemoServer` (set PORT to override the port).

import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = Number(process.env.PORT) || 8433

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`)
    const pathname =
        url.pathname === "/" ? "/demo.html" : decodeURIComponent(url.pathname)

    const filePath = path.join(root, pathname)
    let isServableFile
    try {
        isServableFile =
            filePath.startsWith(root + path.sep) &&
            fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()
    } catch {
        isServableFile = false
    }
    if (!isServableFile) {
        res.writeHead(404, { "content-type": "text/plain" })
        res.end(`Not found: ${pathname}`)
        return
    }

    res.writeHead(200, {
        "content-type":
            MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
        // Always serve the latest build output.
        "cache-control": "no-store",
    })
    fs.createReadStream(filePath).pipe(res)
})

server.listen(port, () => {
    if (!fs.existsSync(path.join(root, "dist/grapher.bundle.js")))
        console.warn(
            "⚠ dist/grapher.bundle.js is missing — run `yarn build` first.\n"
        )

    console.log(`Serving ${root}\n`)
    console.log("Demo pages:")
    console.log(`  http://localhost:${port}/demo.html`)
    console.log(`  http://localhost:${port}/core-econ-demo.html`)
})
