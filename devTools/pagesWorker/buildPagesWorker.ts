// Builds functions/ into a minified Pages "advanced mode" Worker,
// `<dir>/_worker.js/`. `wrangler pages deploy <dir>` uploads that instead of
// building functions/ itself, which it doesn't minify.
//
// Why: every new isolate parses the whole Functions script before it serves a
// request, so its size is part of every cold start.
// https://github.com/owid/owid-grapher/issues/7855
//
// Usage: yarn buildPagesWorker <site output dir>

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { unstable_readConfig } from "wrangler"

const ROOT = path.resolve(import.meta.dirname, "../..")

function main(outDir: string | undefined): void {
    if (!outDir) throw new Error("Usage: buildPagesWorker <site output dir>")
    const workerDir = path.resolve(outDir, "_worker.js")
    const config = unstable_readConfig({
        config: path.join(ROOT, "wrangler.jsonc"),
    })
    fs.rmSync(workerDir, { recursive: true, force: true })
    execFileSync(
        path.join(ROOT, "node_modules/.bin/wrangler"),
        [
            "pages",
            "functions",
            "build",
            "functions",
            "--minify",
            "--outdir",
            workerDir,
            "--compatibility-date",
            config.compatibility_date!,
            ...config.compatibility_flags.flatMap((flag: string) => [
                "--compatibility-flags",
                flag,
            ]),
        ],
        { cwd: ROOT, stdio: "inherit" }
    )
    const size = fs.statSync(path.join(workerDir, "index.js")).size
    console.log(`Built ${workerDir}: ${(size / 1e6).toFixed(1)} MB of JS`)
}

main(process.argv[2])
