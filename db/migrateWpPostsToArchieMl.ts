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

// Hard-coded slugs to avoid WP dependency
// headerMenu.json - gdoc topic page slugs and wp topic page slugs
const entries = new Set([
    "population",
    "population-change",
    "age-structure",
    "gender-ratio",
    "life-and-death",
    "life-expectancy",
    "child-mortality",
    "fertility-rate",
    "distribution-of-the-world-population",
    "urbanization",
    "health",
    "health-risks",
    "air-pollution",
    "outdoor-air-pollution",
    "indoor-air-pollution",
    "obesity",
    "smoking",
    "alcohol-consumption",
    "infectious-diseases",
    "monkeypox",
    "coronavirus",
    "hiv-aids",
    "malaria",
    "eradication-of-diseases",
    "smallpox",
    "polio",
    "pneumonia",
    "tetanus",
    "health-institutions-and-interventions",
    "financing-healthcare",
    "vaccination",
    "life-death-health",
    "maternal-mortality",
    "health-meta",
    "causes-of-death",
    "burden-of-disease",
    "cancer",
    "environment",
    "nuclear-energy",
    "energy-access",
    "renewable-energy",
    "fossil-fuels",
    "waste",
    "plastic-pollution",
    "air-and-climate",
    "co2-and-greenhouse-gas-emissions",
    "climate-change",
    "water",
    "clean-water-sanitation",
    "water-access",
    "sanitation",
    "water-use-stress",
    "land-and-ecosystems",
    "forests-and-deforestation",
    "land-use",
    "natural-disasters",
    "food",
    "nutrition",
    "famines",
    "food-supply",
    "human-height",
    "micronutrient-deficiency",
    "diet-compositions",
    "food-production",
    "meat-production",
    "agricultural-inputs",
    "employment-in-agriculture",
    "growth-inequality",
    "public-sector",
    "government-spending",
    "taxation",
    "military-personnel-spending",
    "financing-education",
    "poverty-and-prosperity",
    "economic-inequality",
    "poverty",
    "economic-growth",
    "economic-inequality-by-gender",
    "labor",
    "child-labor",
    "working-hours",
    "female-labor-supply",
    "corruption",
    "trade-migration",
    "trade-and-globalization",
    "tourism",
    "education",
    "educational-outcomes",
    "global-education",
    "literacy",
    "pre-primary-education",
    "primary-and-secondary-education",
    "quality-of-education",
    "tertiary-education",
    "inputs-to-education",
    "teachers-and-professors",
    "media-education",
    "technology",
    "space-exploration-satellites",
    "transport",
    "work-life",
    "culture",
    "trust",
    "housing",
    "homelessness",
    "time-use",
    "relationships",
    "marriages-and-divorces",
    "social-connections-and-loneliness",
    "happiness-wellbeing",
    "happiness-and-life-satisfaction",
    "human-development-index",
    "politics",
    "human-rights",
    "lgbt-rights",
    "women-rights",
    "democracy",
    "violence-rights",
    "war-peace",
    "biological-and-chemical-weapons",
    "war-and-peace",
    "terrorism",
    "nuclear-weapons",
    "violence",
    "violence-against-rights-for-children",
    "homicides",
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
    ).from(db.knexTable(Post.postsTable).where("id", "=", "1441"))

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
                    type: entries.has(post.slug)
                        ? OwidGdocType.TopicPage
                        : OwidGdocType.Article,
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
