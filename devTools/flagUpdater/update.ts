import { Region, regions } from "@ourworldindata/utils"

import path from "path"
import fs from "fs-extra"
import { glob } from "fs/promises"
import findProjectBaseDir from "../../settings/findBaseDir.ts"

const BASE_DIR = findProjectBaseDir(__dirname)
if (!BASE_DIR) throw new Error("Could not find project base directory")
const FLAG_BASE_PATH = path.join(BASE_DIR, "node_modules/flag-icons/flags/4x3")
const FLAG_TARGET_DIR = path.join(BASE_DIR, "public/images/flags")

const main = async () => {
    const skippedBecauseMissingShortCode: Region[] = []
    const failedBecauseNoFlag: Region[] = []
    let successfulCount: number = 0

    for await (const f of glob(`${FLAG_TARGET_DIR}/*.svg`)) {
        await fs.remove(f)
    }

    await fs.ensureDir(FLAG_TARGET_DIR)

    for (const region of regions) {
        // We want to ensure we have a flag for every non-historical country; others are optional
        const isNonHistoricalCountry =
            region.regionType === "country" && !region.isHistorical

        let shortCode = "shortCode" in region && region.shortCode

        if (region.code === "OWID_KOS") {
            // Kosovo is a special case; it doesn't have an official ISO code,
            // but has been assigned the special "XK" and has a flag under that code
            shortCode = "XK"
        } else if (region.code === "PS_GZA") {
            // Gaza Strip and Palestine use the same flag
            shortCode = "PS"
        }

        if (!shortCode) {
            if (isNonHistoricalCountry)
                skippedBecauseMissingShortCode.push(region)
            continue
        }

        const flagPath = path.join(
            FLAG_BASE_PATH,
            `${shortCode.toLowerCase()}.svg`
        )
        const exists = await fs.pathExists(flagPath)
        if (!exists) {
            if (isNonHistoricalCountry) failedBecauseNoFlag.push(region)
            continue
        }

        const targetPath = path.join(FLAG_TARGET_DIR, `${region.code}.svg`)
        await fs.copy(flagPath, targetPath)
        successfulCount++
    }

    console.log(`Successfully copied ${successfulCount} flags.`)

    if (skippedBecauseMissingShortCode.length > 0) {
        console.log(
            `Skipped ${skippedBecauseMissingShortCode.length} countries because they had no short code:`,
            skippedBecauseMissingShortCode.map((c) => c.name)
        )
    }
    if (failedBecauseNoFlag.length > 0) {
        console.log(
            `Failed to copy flags for ${failedBecauseNoFlag.length} countries because the flag was missing:`,
            failedBecauseNoFlag.map((c) => c.name)
        )
    }
}

void main()
