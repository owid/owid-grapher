/**
 * Builds all bespoke projects and copies their output into dist/assets/bespoke/
 * so the main site bake picks them up automatically.
 *
 * Each project's built JS and CSS end up at:
 *   dist/assets/bespoke/<project>/<files>
 *
 * Usage:
 *   npx tsx bespoke/buildAndDeployProjects.ts           # build all projects
 *   npx tsx bespoke/buildAndDeployProjects.ts example    # build a single project
 */

/* eslint-disable no-console */

import { exec } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import fs from "node:fs/promises"

const execAsync = promisify(exec)

const dirname = import.meta.dirname
const ROOT_DIR = path.resolve(dirname, "..")
const PROJECTS_DIR = path.resolve(dirname, "projects")
const OUTPUT_DIR = path.resolve(ROOT_DIR, "dist", "assets-bespoke")

async function isProject(name: string): Promise<boolean> {
    try {
        await fs.access(path.join(PROJECTS_DIR, name, "vite.config.ts"))
        return true
    } catch {
        return false
    }
}

async function getProjects(): Promise<string[]> {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const checks = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => ({
                name: entry.name,
                valid: await isProject(entry.name),
            }))
    )
    return checks.filter((c) => c.valid).map((c) => c.name)
}

async function buildProject(name: string): Promise<void> {
    const dir = path.join(PROJECTS_DIR, name)
    const distDir = path.join(dir, "dist")
    const outputDir = path.join(OUTPUT_DIR, name)

    console.log(`\n==> Building "${name}"...`)

    await execAsync("yarn install --immutable", { cwd: dir })

    try {
        await execAsync("yarn build", { cwd: dir })
    } catch (err) {
        const stderr =
            err instanceof Error && "stderr" in err
                ? (err as { stderr: string }).stderr
                : String(err)
        throw new Error(`Build failed for "${name}":\n${stderr}`, {
            cause: err,
        })
    }

    try {
        await fs.access(distDir)
    } catch {
        throw new Error(
            `Build for "${name}" succeeded but produced no dist/ output`
        )
    }

    // Remove previous files and copy fresh build output
    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.mkdir(outputDir, { recursive: true })
    await execAsync(`cp -r ${distDir}/* ${outputDir}/`)
    console.log(`    Copied to ${path.relative(ROOT_DIR, outputDir)}/`)
}

// --- main ---

async function main(): Promise<void> {
    const requestedProject = process.argv[2]

    if (requestedProject) {
        if (!(await isProject(requestedProject))) {
            throw new Error(
                `Error: "${requestedProject}" is not a valid bespoke project`
            )
        }
        await buildProject(requestedProject)
    } else {
        const projects = await getProjects()
        if (projects.length === 0) {
            console.log("No bespoke projects found.")
            return
        }

        console.log(
            `Found ${projects.length} bespoke project(s): ${projects.join(", ")}`
        )
        await fs.mkdir(OUTPUT_DIR, { recursive: true })

        for (const project of projects) {
            await buildProject(project)
        }
    }

    console.log("\nDone.")
}

await main().catch((err) => {
    console.error(err)
    process.exit(1)
})
