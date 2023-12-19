import { closeTypeOrmAndKnexConnections } from "../../db/db.js"
import { getPostBySlug } from "../../db/model/Post.js"
import { enrichedBlocksToMarkdown } from "../../db/model/Gdoc/enrichedToMarkdown.js"

import fs from "fs-extra"

import parseArgs from "minimist"
import { OwidGdocBaseInterface, OwidGdocContent } from "@ourworldindata/utils"

async function main() {
    try {
        const post = await getPostBySlug("about")
        const archieMl: OwidGdocBaseInterface = JSON.parse(
            post?.archieml || "{}"
        )
        const markdown = enrichedBlocksToMarkdown(
            archieMl.content.body ?? [],
            true
        )
        console.log(markdown)
        await closeTypeOrmAndKnexConnections()
    } catch (error) {
        await closeTypeOrmAndKnexConnections()
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

main()
