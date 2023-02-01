// WIP: Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import * as cheerio from "cheerio"

import {
    EnrichedBlockText,
    OwidArticlePublicationContext,
    OwidArticleType,
} from "@ourworldindata/utils"
import * as Post from "./model/Post.js"
import fs from "fs"
import {
    cheerioElementsToArchieML,
    withoutEmptyOrWhitespaceOnlyTextBlocks,
    convertAllWpComponentsToArchieMLBlocks,
    getEnrichedBlockTextFromBlockParseResult,
} from "./model/Gdoc/htmlToEnriched.js"

const migrate = async (): Promise<void> => {
    const writeToFile = false
    await db.getConnection()

    const posts = await Post.select(
        "id",
        "slug",
        "title",
        "content",
        "published_at",
        "updated_at"
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "22821"))

    for (const post of posts) {
        try {
            let text = post.content
            const refs = (text.match(/{ref}(.*?){\/ref}/gims) || []).map(
                function (val: string, i: number) {
                    // mutate original text
                    text = text.replace(
                        val,
                        `<a class="ref" href="#note-${i + 1}"><sup>${
                            i + 1
                        }</sup></a>`
                    )
                    // return inner text
                    return val.replace(/\{\/?ref\}/g, "")
                }
            )
            //TODO: we don't seem to get the first node if it is a comment.
            // Maybe this is benign but if not this works as a workaround:
            //`<div>${post.content}</div>`)
            const $: CheerioStatic = cheerio.load(text)
            const bodyContents = $("body").contents().toArray()
            const parsingContext = {
                $,
                shouldParseWpComponents: true,
                htmlTagCounts: {},
                wpTagCounts: {},
            }
            const parsedResult = cheerioElementsToArchieML(
                bodyContents,
                parsingContext
            )
            const archieMlBodyElements = convertAllWpComponentsToArchieMLBlocks(
                withoutEmptyOrWhitespaceOnlyTextBlocks(parsedResult).content
            )

            let errors = parsedResult.errors
            const refParsingResults = refs.map(
                (refString): EnrichedBlockText => {
                    const $ref = cheerio.load(refString)
                    const refElements = $ref("body").contents().toArray()
                    const parseResult = cheerioElementsToArchieML(refElements, {
                        $,
                        shouldParseWpComponents: false,
                        htmlTagCounts: {},
                        wpTagCounts: {},
                    })
                    const textContentResult =
                        getEnrichedBlockTextFromBlockParseResult(parseResult)
                    errors = errors.concat(textContentResult.errors)
                    return {
                        type: "text",
                        value: textContentResult.content.flatMap(
                            (b) => b.value
                        ),
                        parseErrors: textContentResult.content.flatMap(
                            (b) => b.parseErrors
                        ),
                    }
                }
            )

            const archieMlFieldContent: OwidArticleType = {
                googleId: `wp-${post.id}`,
                slug: post.slug,
                content: {
                    body: archieMlBodyElements,
                    title: post.title,
                    byline: "todo", // TOOD: fetch authors from WP and store them in posts table
                    dateline: post.published_at?.toISOString() ?? "",
                    // TODO: this discards block level elements - those might be needed?
                    refs: refParsingResults,
                },
                published: false, // post.published_at !== null,
                createdAt: post.updated_at, // TODO: this is wrong but it doesn't seem we have a created date in the posts table
                publishedAt: null, // post.published_at,
                updatedAt: null, // post.updated_at,
                publicationContext: OwidArticlePublicationContext.listed, // TODO: not all articles are listed, take this from the DB
                revisionId: null,
            }
            const archieMlStatsContent = {
                errors,
                numErrors: errors.length,
                numBlocks: archieMlBodyElements.length,
                htmlTagCounts: parsingContext.htmlTagCounts,
                wpTagCounts: parsingContext.wpTagCounts,
            }

            const insertQuery = `
        UPDATE posts SET archieml = ?, archieml_update_statistics = ? WHERE id = ?
        `
            await db.queryMysql(insertQuery, [
                JSON.stringify(archieMlFieldContent, null, 2),
                JSON.stringify(archieMlStatsContent, null, 2),
                post.id,
            ])
            console.log("inserted", post.id)

            if (writeToFile) {
                try {
                    fs.writeFileSync(
                        `./wpmigration/${post.slug}.html`,
                        post.content
                    )
                    // file written successfully
                } catch (err) {
                    console.error(err)
                }
                const parsedJson = JSON.stringify(archieMlBodyElements, null, 2)
                try {
                    fs.writeFileSync(
                        `./wpmigration/${post.slug}.json`,
                        parsedJson
                    )
                    // file written successfully
                } catch (err) {
                    console.error(err)
                }
            }
        } catch (e) {
            console.error("Caught an exception", post.id)
            throw e
        }
    }

    // const sortedTagCount = _.sortBy(
    //     Array.from(tagCounts.entries()),
    //     ([tag, count]) => tag
    // )
    // for (const [tag, count] of sortedTagCount) {
    //     console.log(`${tag}: ${count}`)
    // }

    await db.closeTypeOrmAndKnexConnections()
}

migrate()
