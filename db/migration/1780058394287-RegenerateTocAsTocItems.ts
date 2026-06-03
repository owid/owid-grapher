import { MigrationInterface, QueryRunner } from "typeorm"
import { generateToc, traverseEnrichedBlock } from "@ourworldindata/utils"
import {
    OwidEnrichedGdocBlock,
    OwidGdocPostContent,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/types"
import { gdocFromJSON } from "../model/Gdoc/GdocFactory.js"

// down() only: strip the chart / narrative-chart anchorIds that
// generateSidebarToc wrote onto the body.
function stripChartAnchorIds(body: OwidEnrichedGdocBlock[] | undefined): void {
    body?.forEach((block) =>
        traverseEnrichedBlock(block, (child) => {
            if (child.type === "chart" || child.type === "narrative-chart")
                delete child.anchorId
        })
    )
}

export class RegenerateTocAsTocItems1780058394287 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Regenerate content.toc in the new Toc shape via generateToc
        // (same gating as the live enrichment path). No anchorId pre-strip
        // needed: existing bodies have none — this stack introduces them, and
        // the only re-run path is down()→up(), where down() strips.
        //
        // Profiles are excluded: they store un-instantiated templates and
        // regenerate their toc per-entity at bake time
        // (instantiateProfileForEntity).
        const rows = (await queryRunner.query(`-- sql
            SELECT id, content
            FROM posts_gdocs
            WHERE published = TRUE
                AND type IN ('article', 'topic-page', 'linear-topic-page')
        `)) as { id: string; content: string }[]

        for (const row of rows) {
            const gdoc = gdocFromJSON(row)
            // All selected types are GdocPost, so content is a post.
            const content = gdoc.content as OwidGdocPostContent

            const toc = generateToc(content)
            if (toc) content.toc = toc
            // The old toc was generated unconditionally, so pages with no TOC
            // consumer carry a stale one that must be removed.
            else delete content.toc

            await queryRunner.query(
                `-- sql
                UPDATE posts_gdocs SET content = ? WHERE id = ?`,
                [JSON.stringify(content), gdoc.id]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reconstruct the previous TocHeadingWithTitleSupertitle[] shape from
        // the new Toc and strip chart anchorIds. Pages up() left without a
        // toc get an empty one — fine, every page re-derives its toc on next
        // publish.
        const rows = (await queryRunner.query(`-- sql
            SELECT id, content
            FROM posts_gdocs
            WHERE published = TRUE
                AND type IN ('article', 'topic-page', 'linear-topic-page')
        `)) as { id: string; content: string }[]

        for (const row of rows) {
            const content = JSON.parse(row.content) as OwidGdocPostContent
            const toc = content.toc

            let legacyToc: TocHeadingWithTitleSupertitle[] = []
            if (toc?.kind === "sidebar") {
                legacyToc = toc.sections.map((section) => ({
                    text: section.heading.text,
                    slug: section.heading.slug,
                    title: section.heading.text,
                    supertitle: section.heading.supertitle ?? "",
                    isSubheading: false,
                }))
            } else if (toc?.kind === "inline") {
                legacyToc = toc.headings.map((heading) => ({
                    text: heading.text,
                    slug: heading.slug,
                    title: heading.text,
                    supertitle: heading.supertitle ?? "",
                    isSubheading: heading.level === 3,
                }))
            }

            stripChartAnchorIds(content.body)
            content.toc = legacyToc as unknown as OwidGdocPostContent["toc"]

            await queryRunner.query(
                `-- sql
                UPDATE posts_gdocs SET content = ? WHERE id = ?`,
                [JSON.stringify(content), row.id]
            )
        }
    }
}
