import { MigrationInterface, QueryRunner } from "typeorm"
import {
    BlockSize,
    OwidGdocPostContent,
    OwidGdocType,
    type EnrichedBlockText,
} from "@ourworldindata/types"
import { enrichedBlocksToMarkdown } from "@ourworldindata/gdoc-pipeline"
import {
    BAKED_BASE_URL,
    GRAPHER_TEST_DB_NAME,
} from "../../settings/serverSettings.js"

/**
 * Seeds an unlisted article with the income distribution walkthrough, so the
 * branch's staging server has a page to show it on without a Google Doc.
 * Only runs on staging servers and local dev databases (not the db test
 * suite's, whose tests iterate over published gdocs); remove this migration before
 * the branch is merged.
 *
 * The id is not a Google Doc, so the article can't be opened in the admin's
 * gdoc preview (which also fetches from Google); it bakes and renders as any
 * other published article.
 */
const GDOC_ID = "seed-income-walkthrough-staging"
const SLUG = "income-walkthrough"

const text = (value: string): EnrichedBlockText => ({
    type: "text",
    value: [{ spanType: "span-simple-text", text: value }],
    parseErrors: [],
})

const content: OwidGdocPostContent = {
    type: OwidGdocType.Article,
    title: "Incomes around the world",
    subtitle:
        "How household surveys from almost every country add up to a picture of incomes across the whole world, and how unequal that picture is.",
    excerpt:
        "A scrolling walkthrough of how income is distributed across the world's population.",
    authors: ["Our World in Data team"],
    authorRoles: {},
    dateline: "October 2026",
    toc: [],
    refs: { definitions: {}, errors: [] },
    body: [
        text(
            "Scroll down to see where the data on incomes around the world comes from, and what it tells us about how incomes are distributed."
        ),
        {
            type: "bespoke-component",
            bundle: "income-distribution",
            variant: "walkthrough",
            size: BlockSize.Widest,
            config: {},
            parseErrors: [],
        },
        {
            type: "heading",
            level: 2,
            text: [
                {
                    spanType: "span-simple-text",
                    text: "Explore the data yourself",
                },
            ],
            parseErrors: [],
        },
        text(
            "The chart below picks up where the walkthrough ends: incomes per day, with a poverty line at $30 a day. Click the chart to move the line, switch to individual countries, or show incomes in another currency."
        ),
        {
            type: "bespoke-component",
            bundle: "income-distribution",
            variant: "distribution",
            size: BlockSize.Wide,
            config: { povertyLine: "30", timeInterval: "daily" },
            parseErrors: [],
        },
    ],
}

/** Staging servers are served from http://staging-site-<branch> */
async function shouldSeed(queryRunner: QueryRunner): Promise<boolean> {
    const [{ name }]: { name: string }[] = await queryRunner.query(
        "SELECT DATABASE() AS name"
    )
    if (name === GRAPHER_TEST_DB_NAME) return false
    return (
        BAKED_BASE_URL.includes("staging-site-") ||
        BAKED_BASE_URL.includes("localhost")
    )
}

export class SeedIncomeWalkthroughGdoc1793095992331 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await shouldSeed(queryRunner))) return

        const markdown = enrichedBlocksToMarkdown(content.body ?? [], true)
        await queryRunner.query(
            `-- sql
            INSERT INTO posts_gdocs
                (id, slug, content, published, publishedAt, publicationContext, revisionId, markdown)
            VALUES (?, ?, ?, 1, NOW(), 'unlisted', NULL, ?)
            ON DUPLICATE KEY UPDATE
                slug = VALUES(slug),
                content = VALUES(content),
                markdown = VALUES(markdown)`,
            [GDOC_ID, SLUG, JSON.stringify(content), markdown ?? null]
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM posts_gdocs WHERE id = ?`, [
            GDOC_ID,
        ])
    }
}
