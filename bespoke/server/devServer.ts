/* eslint-disable no-console */

/**
 * Bespoke dev server — a reverse proxy that lazily starts a Vite dev server
 * for each project under bespoke/projects/ on first request.
 *
 * Requests to /<project>/* are routed to the corresponding Vite instance.
 * WebSocket upgrades (for Vite HMR) are proxied at the TCP level.
 * Visiting / lists all available projects.
 *
 * Usage:  npx tsx devServer.ts
 * Port:   defaults to 8089, override with PORT env var
 */

import http from "node:http"
import net from "node:net"
import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import fs from "node:fs"

const dirname = import.meta.dirname
const PORT = parseInt(process.env.PORT ?? "8089", 10)
const PROJECTS_DIR = path.resolve(dirname, "..", "projects")
const SHARED_DIR = path.resolve(dirname, "..", "shared")

interface ProjectServer {
    port: number
    process: ChildProcess
    ready: Promise<void>
    entrypoints: Record<string, string> | null
}

// Map of project name -> running Vite server info
const servers = new Map<string, ProjectServer>()

// Bind to an ephemeral port and return it, so each Vite instance gets a unique port
function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer()
        srv.listen(0, () => {
            const addr = srv.address() as net.AddressInfo
            srv.close(() => resolve(addr.port))
        })
        srv.on("error", reject)
    })
}

function isProject(name: string): boolean {
    return fs.existsSync(path.join(PROJECTS_DIR, name, "vite.config.ts"))
}

/**
 * Returns the running server for a project, starting one if needed.
 * Concurrent callers for the same project will share the same Promise,
 * so only one Vite process is ever spawned per project.
 */
async function getOrStartProject(name: string): Promise<ProjectServer | null> {
    if (servers.has(name)) {
        const existing = servers.get(name)!
        await existing.ready
        return existing
    }
    if (!isProject(name)) return null

    const entrypoints = getProjectEntrypoints(name)
    if (!entrypoints) {
        console.warn(
            `[${name}] Warning: missing "entrypoints" field in package.json. `
        )
    }

    const port = await findFreePort()
    const dir = path.join(PROJECTS_DIR, name)

    let resolveReady: () => void
    const ready = new Promise<void>((r) => {
        resolveReady = r
    })

    console.log(`Starting Vite for "${name}" (${dir}) on port ${port}...`)

    const proc = spawn(
        "npx",
        ["vite", "dev", "--port", String(port), "--base", `/${name}/`],
        {
            cwd: dir,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, FORCE_COLOR: "1" },
        }
    )

    proc.stdout!.on("data", (data: Buffer) => {
        const text = data.toString().trim()
        if (text) console.log(`[${name}] ${text}`)
        if (text.includes("Local:") || text.includes("ready in")) {
            resolveReady!()
        }
    })

    proc.stderr!.on("data", (data: Buffer) => {
        const text = data.toString().trim()
        if (text) console.error(`[${name}] ${text}`)
    })

    proc.on("exit", (code: number | null) => {
        console.log(`[${name}] Vite exited with code ${code}`)
        servers.delete(name)
    })

    // Store entry before awaiting so concurrent requests share the same Promise
    const entry: ProjectServer = { port, process: proc, ready, entrypoints }
    servers.set(name, entry)

    await ready
    console.log(`[${name}] Ready at http://localhost:${PORT}/${name}/`)
    return entry
}

// Buffer the full request body so it can be re-sent on retries
function collectBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = []
        req.on("data", (chunk: Buffer) => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks)))
    })
}

// Forward an HTTP request to the target Vite port, retrying on ECONNREFUSED
function sendProxy(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetPort: number,
    body: Buffer,
    retries: number
): void {
    const proxyReq = http.request(
        {
            hostname: "localhost",
            port: targetPort,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, "content-length": String(body.length) },
        },
        (proxyRes: http.IncomingMessage) => {
            res.writeHead(proxyRes.statusCode!, proxyRes.headers)
            proxyRes.pipe(res)
        }
    )

    proxyReq.on("error", (err: NodeJS.ErrnoException) => {
        if (retries > 0 && err.code === "ECONNREFUSED") {
            setTimeout(
                () => sendProxy(req, res, targetPort, body, retries - 1),
                200
            )
        } else {
            res.writeHead(502, { "Content-Type": "text/plain" })
            res.end(`Bad gateway: ${err.message}`)
        }
    })

    proxyReq.end(body)
}

async function proxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetPort: number
): Promise<void> {
    const body = await collectBody(req)
    sendProxy(req, res, targetPort, body, 5)
}

// Proxy a WebSocket upgrade at the TCP level by replaying the raw HTTP headers
function proxyWebSocket(
    req: http.IncomingMessage,
    socket: net.Socket,
    head: Buffer,
    targetPort: number
): void {
    const target = net.createConnection(
        { port: targetPort, host: "localhost" },
        () => {
            let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
                raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`
            }
            raw += "\r\n"

            target.write(raw)
            if (head.length > 0) target.write(head)
            socket.pipe(target).pipe(socket)
        }
    )

    target.on("error", () => socket.destroy())
    socket.on("error", () => target.destroy())
}

// Serve the shared component demo page for /<project>/demo,
// with the project name substituted into the template
const demoTemplate = fs.readFileSync(
    path.join(dirname, "component-demo.html"),
    "utf-8"
)

function serveDemoPage(
    projectName: string,
    res: http.ServerResponse
): void {
    const html = demoTemplate
        .replaceAll("{{PROJECT}}", projectName)
        .replaceAll("{{SHARED_DIR}}", SHARED_DIR)
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(html)
}

// Read the "entrypoints" field from a project's package.json,
// mapping e.g. { js: "src/index.ts", css: "src/index.css" }
function getProjectEntrypoints(
    projectName: string
): Record<string, string> | null {
    const pkgPath = path.join(PROJECTS_DIR, projectName, "package.json")
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
        return pkg.entrypoints ?? null
    } catch {
        return null
    }
}

// Map well-known filenames to the entrypoints key they correspond to
const ENTRYPOINT_ALIASES: Record<string, string> = {
    "index.js": "js",
    "index.css": "css",
}

// If the request is for /<project>/index.js or /<project>/index.css,
// redirect to the actual source entrypoint so Vite can serve it
function tryEntrypointRedirect(
    projectName: string,
    pathname: string,
    res: http.ServerResponse,
    entrypoints: Record<string, string> | null
): boolean {
    const prefix = `/${projectName}/`
    if (!pathname.startsWith(prefix)) return false

    const tail = pathname.slice(prefix.length)
    const entrypointKey = ENTRYPOINT_ALIASES[tail]
    if (!entrypointKey) return false

    if (!entrypoints?.[entrypointKey]) return false

    res.writeHead(302, { Location: `/${projectName}/${entrypoints[entrypointKey]}` })
    res.end()
    return true
}

// Extract the project name (first path segment) from a URL
function getProjectName(url: string): string | null {
    const parts = url.split("/").filter(Boolean)
    const name = parts[0]?.split("?")[0]
    return name || null
}

function listProjectsPage(): string {
    const dirs = fs
        .readdirSync(PROJECTS_DIR)
        .filter((d: string) => isProject(d))
    const links = dirs
        .map((p: string) => `<li><a href="/${p}/demo">${p}</a></li>`)
        .join("\n")
    return `<!doctype html>
<html>
<head><title>Bespoke Dev Server</title></head>
<body>
  <h2>Bespoke Projects</h2>
  <ul>${links}</ul>
</body>
</html>`
}

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}

const server = http.createServer(
    async (req: http.IncomingMessage, res: http.ServerResponse) => {
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
            res.setHeader(key, value)
        }

        if (req.method === "OPTIONS") {
            res.writeHead(204)
            res.end()
            return
        }

        const projectName = getProjectName(req.url || "/")

        if (!projectName) {
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(listProjectsPage())
            return
        }

        const project = await getOrStartProject(projectName)
        if (!project) {
            res.writeHead(404, { "Content-Type": "text/plain" })
            res.end(`Project "${projectName}" not found`)
            return
        }

        const pathname = (req.url || "/").split("?")[0]

        // Redirect /<project>/index.js and /<project>/index.css to actual entrypoints
        if (tryEntrypointRedirect(projectName, pathname, res, project.entrypoints)) return

        // Serve the shared demo page for /<project>/demo
        if (pathname === `/${projectName}/demo` || pathname === `/${projectName}/demo/`) {
            serveDemoPage(projectName, res)
            return
        }

        proxyRequest(req, res, project.port)
    }
)

// Forward WebSocket upgrades to the right Vite instance (needed for HMR)
server.on(
    "upgrade",
    async (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
        const projectName = getProjectName(req.url || "/")
        if (!projectName) {
            socket.destroy()
            return
        }

        const project = await getOrStartProject(projectName)
        if (!project) {
            socket.destroy()
            return
        }

        proxyWebSocket(req, socket, head, project.port)
    }
)

// Graceful shutdown: kill all spawned Vite processes
function shutdown(): void {
    console.log("\nShutting down...")
    for (const [name, { process: proc }] of servers) {
        console.log(`Stopping ${name}...`)
        proc.kill()
    }
    process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

server.listen(PORT, () => {
    console.log(`Bespoke dev server running at http://localhost:${PORT}`)
    console.log(`Projects directory: ${PROJECTS_DIR}`)
})
