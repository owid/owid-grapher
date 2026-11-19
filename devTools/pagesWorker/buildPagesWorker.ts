// Builds functions/ into a Pages "advanced mode" Worker, a `_worker.js/`
// folder of modules, with the chart-rendering handlers in a module of their
// own. `wrangler pages deploy` of a folder holding `_worker.js/` uploads that
// instead of building functions/ into a single script.
//
// Why: a single script is parsed in full by every new isolate, and the render
// routes (grapher and explorer libraries, React SSR) are most of it. Here they
// are a separate module that's loaded on first use, see
// functions/_common/loadRenderRoutes.ts. https://github.com/owid/owid-grapher/issues/7855
//
// Usage: yarn buildPagesWorker <site output dir>
// Writes <site output dir>/_worker.js/.

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { unstable_readConfig } from "wrangler"

const ROOT = path.resolve(import.meta.dirname, "../..")
const WRANGLER = path.join(ROOT, "node_modules/.bin/wrangler")

// The import in loadRenderRoutes.ts, as written. It's kept out of the main
// module, then pointed at the render module.
const RENDER_IMPORT = "./lazyRoutes/index.js"
const RENDER_ENTRY = path.join(ROOT, "functions/_common/lazyRoutes/index.ts")
const RENDER_MODULE = "renderRoutes.js"
// A definition that only the render module holds. The main module calls the
// handler too, but only through destructuring (`{ handleGrapherRequest } =`).
const RENDER_DEFINITION = /\bhandleGrapherRequest\s*=/

function wrangler(args: string[]): void {
    execFileSync(WRANGLER, args, { cwd: ROOT, stdio: "inherit" })
}

function main(outDir: string | undefined): void {
    if (!outDir) throw new Error("Usage: buildPagesWorker <site output dir>")
    const workerDir = path.resolve(outDir, "_worker.js")
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pages-worker-"))
    try {
        const config = unstable_readConfig({
            config: path.join(ROOT, "wrangler.jsonc"),
        })
        const compat = [
            "--compatibility-date",
            config.compatibility_date!,
            ...config.compatibility_flags.flatMap((flag: string) => [
                "--compatibility-flags",
                flag,
            ]),
        ]

        // 1. functions/ as Pages builds it, minus the render handlers.
        wrangler([
            "pages",
            "functions",
            "build",
            "functions",
            "--outdir",
            path.join(tmp, "main"),
            "--external",
            RENDER_IMPORT,
            ...compat,
        ])

        // 2. The render handlers as a module of their own, with their wasm
        // and fonts. A Worker dry run bundles it the way a deploy would.
        const renderConfig = path.join(tmp, "render.wrangler.json")
        fs.writeFileSync(
            renderConfig,
            JSON.stringify({
                name: "render-routes",
                main: RENDER_ENTRY,
                compatibility_date: config.compatibility_date,
                compatibility_flags: config.compatibility_flags,
            })
        )
        wrangler([
            "deploy",
            "--dry-run",
            "--outdir",
            path.join(tmp, "render"),
            "--config",
            renderConfig,
        ])

        // 3. Assemble _worker.js/. `pages deploy` bundles index.js again and
        // would inline a module that a literal import names, so the import
        // becomes an expression it can't resolve. The runtime resolves it
        // against the other uploaded modules.
        fs.rmSync(workerDir, { recursive: true, force: true })
        fs.mkdirSync(workerDir, { recursive: true })
        const mainJs = fs.readFileSync(path.join(tmp, "main/index.js"), "utf8")
        const literal = `import(${JSON.stringify(RENDER_IMPORT)})`
        const occurrences = mainJs.split(literal).length - 1
        if (occurrences !== 1)
            throw new Error(
                `Expected one ${literal} in the main module, found ${occurrences}`
            )
        fs.writeFileSync(
            path.join(workerDir, "index.js"),
            mainJs.replace(
                literal,
                `import(String(${JSON.stringify(`./${RENDER_MODULE}`)}))`
            )
        )
        copyModules(path.join(tmp, "main"), workerDir, null)
        copyModules(path.join(tmp, "render"), workerDir, RENDER_MODULE)

        // 4. Check the main module as `pages deploy` will upload it: a
        // `functions build` of a missing functions folder bundles _worker.js/,
        // and --outfile writes the upload's multipart form.
        const upload = path.join(tmp, "upload")
        wrangler([
            "pages",
            "functions",
            "build",
            path.join(tmp, "no-functions"),
            "--build-output-directory",
            path.resolve(outDir),
            "--outfile",
            upload,
            ...compat,
        ])
        const mainModule = mainModuleOf(fs.readFileSync(upload, "utf8"))
        if (RENDER_DEFINITION.test(mainModule))
            throw new Error(
                "The render handlers ended up in the main module, so the split didn't work"
            )
        console.log(
            `Built ${workerDir}: main module ${mb(mainModule.length)}, ${RENDER_MODULE} ${mb(fs.statSync(path.join(workerDir, RENDER_MODULE)).size)}`
        )
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
    }
}

// Copies a wrangler output folder's modules (JS, wasm, data) without source
// maps and wrangler's README. Its entry, index.js, is copied as `indexAs`, or
// skipped when that's null.
function copyModules(from: string, to: string, indexAs: string | null): void {
    for (const file of fs.readdirSync(from)) {
        if (file.endsWith(".map") || file === "README.md") continue
        const target = file === "index.js" ? indexAs : file
        if (target)
            fs.copyFileSync(path.join(from, file), path.join(to, target))
    }
}

// The main module's source from a Workers upload form (multipart/form-data
// whose "metadata" part names the main module).
function mainModuleOf(form: string): string {
    const boundary = form.slice(0, form.indexOf("\r\n"))
    const parts = form.split(boundary).map((part) => {
        const [head, ...body] = part.split("\r\n\r\n")
        const name = head.match(/name="([^"]+)"/)?.[1]
        return { name, body: body.join("\r\n\r\n") }
    })
    const metadata = parts.find((part) => part.name === "metadata")
    if (!metadata) throw new Error("No metadata in the upload form")
    const { main_module } = JSON.parse(metadata.body) as { main_module: string }
    const main = parts.find((part) => part.name === main_module)
    if (!main) throw new Error(`No ${main_module} in the upload form`)
    return main.body
}

function mb(bytes: number): string {
    return `${(bytes / 1e6).toFixed(1)} MB`
}

main(process.argv[2])
