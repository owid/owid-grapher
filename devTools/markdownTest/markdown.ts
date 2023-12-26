import { closeTypeOrmAndKnexConnections } from "../../db/db.js"
import { getPostRawBySlug } from "../../db/model/Post.js"
import { enrichedBlocksToMarkdown } from "../../db/model/Gdoc/enrichedToMarkdown.js"

import fs from "fs-extra"

import parseArgs from "minimist"
import { OwidGdocBaseInterface, OwidGdocContent } from "@ourworldindata/utils"
import { parsePostArchieml } from "@ourworldindata/utils/dist/dbTypes/PostsUtilities.js"

async function main() {
    try {
        const post = await getPostRawBySlug("about")
        const archieMl: OwidGdocBaseInterface | null = post?.archieml
            ? parsePostArchieml(post?.archieml)
            : null
        const markdown = enrichedBlocksToMarkdown(
            archieMl?.content.body ?? [],
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
