import { afterEach, beforeEach, expect, it } from "vitest"
import fs from "fs-extra"
import os from "os"
import path from "path"

import { removeBakedExplorerPages } from "./ExplorerBaker.js"

let outputFolder: string

beforeEach(async () => {
    outputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "explorer-bake-"))
})

afterEach(async () => {
    await fs.remove(outputFolder)
})

it("removes stale explorer pages but keeps other baked artifacts", async () => {
    await fs.writeFile(path.join(outputFolder, "stale-explorer.html"), "stale")
    await fs.writeFile(path.join(outputFolder, "_explorerRedirects.json"), "{}")

    await removeBakedExplorerPages(outputFolder)

    expect(
        await fs.pathExists(path.join(outputFolder, "stale-explorer.html"))
    ).toBe(false)
    expect(
        await fs.pathExists(path.join(outputFolder, "_explorerRedirects.json"))
    ).toBe(true)
})

it("creates the output folder if it doesn't exist yet", async () => {
    const missingFolder = path.join(outputFolder, "explorers")

    await removeBakedExplorerPages(missingFolder)

    expect(await fs.pathExists(missingFolder)).toBe(true)
})
