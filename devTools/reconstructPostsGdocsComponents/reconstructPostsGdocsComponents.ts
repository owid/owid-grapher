import parseArgs from "minimist"
import { knexRaw, knexReadWriteTransaction } from "../../db/db.js"
import {
    DbInsertPostGdocComponent,
    DbRawPostGdoc,
    parsePostGdocContent,
    serializePostGdocComponentConfig,
} from "@ourworldindata/types"
import { enumerateGdocComponentsWithoutChildren } from "../../db/model/Gdoc/extractGdocComponentInfo.js"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    await knexReadWriteTransaction(async (trx) => {
        await knexRaw(trx, `DELETE FROM posts_gdocs_components`)
        console.log("Deleted all rows from posts_gdocs_components")
        const postsGdocsRaw = await knexRaw<
            Pick<DbRawPostGdoc, "id" | "content">
        >(trx, `SELECT id, content FROM posts_gdocs`)
        console.log(`Found ${postsGdocsRaw.length} posts_gdocs`)

        for (const gdocRaw of postsGdocsRaw) {
            try {
                const gdocEnriched = {
                    ...gdocRaw,
                    content: parsePostGdocContent(gdocRaw.content),
                }
                const startPath = "$.body"
                const body = gdocEnriched.content.body
                const componentInfos = []
                if (body)
                    for (let i = 0; i < body.length; i++) {
                        const components =
                            enumerateGdocComponentsWithoutChildren(
                                body[i],
                                startPath,
                                `${startPath}[${i}]`
                            )
                        componentInfos.push(...components)
                    }
                const insertData = componentInfos.map(
                    (componentInfo) =>
                        ({
                            gdocId: gdocRaw.id,
                            path: componentInfo.path,
                            parent: componentInfo.parentPath,
                            config: serializePostGdocComponentConfig(
                                componentInfo.content
                            ),
                        }) satisfies DbInsertPostGdocComponent
                )
                if (insertData.length > 0)
                    await trx("posts_gdocs_components").insert(insertData)
            } catch (e) {
                console.error(`Error processing post ${gdocRaw.id}`)
                console.error(e)
            }
        }
        console.log("Inserted all components into posts_gdocs_components")
    })
    process.exit(0)
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(
        `reconstructPostsGdocsComponents - Reconstruct posts_gdocs_components table from posts_gdocs table`
    )
} else {
    main(parsedArgs)
}
