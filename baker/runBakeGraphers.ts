#! /usr/bin/env yarn tsn
import { bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers } from "./GrapherBaker"

/**
 * This bakes all the Graphers to a folder on your computer, running the same baking code as the SiteBaker.
 *
 * Usage: ./runBakeGraphers.ts ~/folder_to_bake_to
 */

const main = async (folder: string) => {
    await bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers(
        folder
    )
}

const dir = process.argv.slice(2).join(" ")
main(dir)
