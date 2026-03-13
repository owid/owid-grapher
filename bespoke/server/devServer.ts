import http from "node:http"
import net from "node:net"
import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? "8089", 10)
const PROJECTS_DIR = path.resolve(__dirname, "..", "projects")

interface ProjectServer {
    port: number
    process: ChildProcess
    ready: Promise<void>
}

const servers = new Map<string, ProjectServer>()

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

async function getOrStartProject(
    name: string
): Promise<ProjectServer | null> {
    if (servers.has(name)) {
        const existing = servers.get(name)!
        await existing.ready
        return existing
    }
    if (!isProject(name)) return null

    const port = await findFreePort()
    const dir = path.join(PROJECTS_DIR, name)

    let resolveReady: () => void
    const ready = new Promise<void>((r) => {
        resolveReady = r
    })

    console.log(
        `Starting Vite for "${name}" (${dir}) on port ${port}...`
    )

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

    proc.on("exit", (code) => {
        console.log(`[${name}] Vite exited with code ${code}`)
        servers.delete(name)
    })

    const entry: ProjectServer = { port, process: proc, ready }
    servers.set(name, entry)

    await ready
    console.log(`[${name}] Ready at http://localhost:${PORT}/${name}/`)
    return entry
}

function collectBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = []
        req.on("data", (chunk: Buffer) => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks)))
    })
}

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
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode!, proxyRes.headers)
            proxyRes.pipe(res)
        }
    )

    proxyReq.on("error", (err) => {
        if (retries > 0 && err.message.includes("ECONNREFUSED")) {
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

function proxyWebSocket(
    req: http.IncomingMessage,
    socket: net.Socket,
    head: Buffer,
    targetPort: number
): void {
    const target = net.createConnection(
        { port: targetPort, host: "localhost" },
        () => {
            // Reconstruct the raw HTTP upgrade request
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

function getProjectName(url: string): string | null {
    const parts = url.split("/").filter(Boolean)
    // Strip query string from first segment
    const name = parts[0]?.split("?")[0]
    return name || null
}

function listProjectsPage(): string {
    const dirs = fs.readdirSync(PROJECTS_DIR).filter((d) => isProject(d))
    const links = dirs
        .map((p) => `<li><a href="/${p}/">${p}</a></li>`)
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

const server = http.createServer(async (req, res) => {
    // Set CORS headers on every response
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
        res.setHeader(key, value)
    }

    // Handle preflight requests
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

    proxyRequest(req, res, project.port)
})

// Handle WebSocket upgrades (needed for Vite HMR)
server.on("upgrade", async (req, socket, head) => {
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
})

// Graceful shutdown: kill all Vite processes
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
