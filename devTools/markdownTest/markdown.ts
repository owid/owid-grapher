import { closeTypeOrmAndKnexConnections, getConnection } from "../../db/db.js"
import { getPostRawBySlug } from "../../db/model/Post.js"
import { enrichedBlocksToMarkdown } from "../../db/model/Gdoc/enrichedToMarkdown.js"
import { GdocBase } from "../../db/model/Gdoc/GdocBase.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"

import fs from "fs-extra"

import parseArgs from "minimist"
import {
    OwidEnrichedGdocBlock,
    OwidGdocBaseInterface,
    OwidGdocContent,
} from "@ourworldindata/utils"
import { parsePostArchieml } from "@ourworldindata/utils/dist/dbTypes/PostsUtilities.js"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const connection = await getConnection()
        const gdoc = await GdocBase.findOneBy({ slug: parsedArgs._[0] })
        let archieMlContent: OwidEnrichedGdocBlock[] | null
        let contentToShowOnError: any
        if (!gdoc) {
            const post = await getPostRawBySlug(parsedArgs._[0])
            if (!post) {
                console.error("No post found")
                process.exit(-1)
            }
            archieMlContent = post?.archieml
                ? parsePostArchieml(post?.archieml)?.content?.body
                : null
            contentToShowOnError = post?.archieml
        } else {
            archieMlContent = gdoc.enrichedBlockSources.flat()
            contentToShowOnError = gdoc?.content
        }

        if (!archieMlContent) {
            console.error("No archieMl found")
            process.exit(-1)
        }
        const markdown = enrichedBlocksToMarkdown(archieMlContent ?? [], true)
        if (!markdown) {
            console.error("No markdown found")
            console.log(contentToShowOnError)
            process.exit(-1)
        }
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

const parsedArgs = parseArgs(process.argv.slice(2))
main(parsedArgs)
