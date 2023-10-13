import * as db from "./db.js"
import cheerio from "cheerio"

import {
    OwidGdocPublicationContext,
    OwidGdocInterface,
    sortBy,
    OwidArticleBackportingStatistics,
    OwidGdocType,
    RelatedChart,
    EnrichedBlockAllCharts,
} from "@ourworldindata/utils"
import * as Post from "./model/Post.js"
import fs from "fs"
import {
    cheerioElementsToArchieML,
    withoutEmptyOrWhitespaceOnlyTextBlocks,
    convertAllWpComponentsToArchieMLBlocks,
    adjustHeadingLevels,
} from "./model/Gdoc/htmlToEnriched.js"
import { getRelatedCharts } from "./wpdb.js"

// slugs from all the linear entries we want to migrate from @edomt
const entries = new Set([
    "age-structure",
    "air-pollution",
    "alcohol-consumption",
    "burden-of-disease",
    "cancer",
    "child-labor",
    "corruption",
    "economic-inequality-by-gender",
    "eradication-of-diseases",
    "famines",
    "female-labor-supply",
    "fertility-rate",
    "financing-healthcare",
    "fish-and-overfishing",
    "food-supply",
    "gender-ratio",
    "government-spending",
    "happiness-and-life-satisfaction",
    "health-meta",
    "hiv-aids",
    "homelessness",
    "human-height",
    "indoor-air-pollution",
    "land-use",
    "literacy",
    "malaria",
    "marriages-and-divorces",
    "maternal-mortality",
    "meat-production",
    "micronutrient-deficiency",
    "natural-disasters",
    "nuclear-weapons",
    "obesity",
    "outdoor-air-pollution",
    "pneumonia",
    "polio",
    "sanitation",
    "smallpox",
    "smoking",
    "social-connections-and-loneliness",
    "taxation",
    "tetanus",
    "time-use",
    "trade-and-globalization",
    "transport",
    "urbanization",
    "vaccination",
    "violence-against-rights-for-children",
    "water-access",
    "water-use-stress",
    "working-hours",
])

const migrate = async (): Promise<void> => {
    const writeToFile = false
    const errors = []
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
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "29766"))

    for (const post of posts) {
        try {
            const isEntry = entries.has(post.slug)
            const text = post.content
            let relatedCharts: RelatedChart[] = []
            if (isEntry) {
                relatedCharts = await getRelatedCharts(post.id)
            }

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
                isEntry,
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

            if (relatedCharts.length) {
                const allChartsBlock: EnrichedBlockAllCharts = {
                    type: "all-charts",
                    parseErrors: [],
                    heading: `Interactive Charts on ${post.title}`,
                    top: [],
                }

                archieMlBodyElements.push(allChartsBlock)
            }

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
                    toc: [],
                    title: post.title,
                    subtitle: post.excerpt,
                    excerpt: post.excerpt,
                    authors: sortBy(authors, ["order"]).map(
                        (author) => author.author
                    ),
                    dateline: dateline,
                    // TODO: this discards block level elements - those might be needed?
                    refs: undefined,
                    type: isEntry
                        ? OwidGdocType.TopicPage
                        : OwidGdocType.Article,
                },
                relatedCharts,
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
            errors.push(e)
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

    if (errors.length > 0) {
        console.error("Errors", errors)
        throw new Error(`${errors.length} items had errors`)
    }
}

migrate()
