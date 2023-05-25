// WIP: Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import cheerio from "cheerio"

import {
    OwidGdocPublicationContext,
    OwidGdocInterface,
    sortBy,
    OwidArticleBackportingStatistics,
    OwidGdocType,
} from "@ourworldindata/utils"
import * as Post from "./model/Post.js"
import fs from "fs"
import {
    cheerioElementsToArchieML,
    withoutEmptyOrWhitespaceOnlyTextBlocks,
    convertAllWpComponentsToArchieMLBlocks,
    adjustHeadingLevels,
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
        "updated_at_in_wordpress",
        "authors",
        "excerpt",
        "created_at_in_wordpress",
        "updated_at"
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "22821"))

    for (const post of posts) {
        try {
            const text = post.content

            // We don't get the first and last nodes if they are comments.
            // This can cause issues with the wp:components so here we wrap
            // everything in a div
            const $: CheerioStatic = cheerio.load(`<div>${text}</div>`)
            const bodyContents = $("body>div").contents().toArray()
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

            // Heading levels used to start at 2, in the new layout system they start at 1
            // This function iterates all blocks recursively and adjusts the heading levels inline
            adjustHeadingLevels(archieMlBodyElements)

            const errors = parsedResult.errors

            // Format publishing date
            const options = {
                year: "numeric",
                month: "long",
                day: "numeric",
            } as const
            const dateline = post.published_at
                ? post.published_at.toLocaleDateString("en-US", options)
                : ""

            const authors: { author: string; order: number }[] = JSON.parse(
                post.authors
            )

            const archieMlFieldContent: OwidGdocInterface = {
                id: `wp-${post.id}`,
                slug: post.slug,
                content: {
                    body: archieMlBodyElements,
                    title: post.title,
                    subtitle: post.excerpt,
                    excerpt: post.excerpt,
                    authors: sortBy(authors, ["order"]).map(
                        (author) => author.author
                    ),
                    dateline: dateline,
                    // TODO: this discards block level elements - those might be needed?
                    refs: undefined,
                    type: OwidGdocType.Article,
                },
                published: false,
                createdAt:
                    post.created_at_in_wordpress ??
                    post.updated_at_in_wordpress ??
                    post.updated_at ??
                    new Date(),
                publishedAt: post.published_at,
                updatedAt: post.updated_at_in_wordpress,
                publicationContext: OwidGdocPublicationContext.listed, // TODO: not all articles are listed, take this from the DB
                revisionId: null,
            }
            const archieMlStatsContent = {
                errors,
                numErrors: errors.length,
                numBlocks: archieMlBodyElements.length,
                htmlTagCounts: parsingContext.htmlTagCounts,
                wpTagCounts: parsingContext.wpTagCounts,
            } as OwidArticleBackportingStatistics

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
