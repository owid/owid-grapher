import { MigrationInterface, QueryRunner } from "typeorm"
import { enrichedBlocksToMarkdown } from "../model/Gdoc/enrichedToMarkdown.js"
import { gdocFromJSON } from "../model/Gdoc/GdocFactory.js"

export class FixMalformedGdocMarkdown1747337107717
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const malformedGdocQuery = `-- sql
            SELECT
                id,
                content
            FROM
                posts_gdocs pg
            WHERE
                (
                    pg.markdown IS NULL
                    OR pg.markdown LIKE "%undefined%"
                    OR pg.markdown LIKE "%docs.google.com/document%"
                )
                AND pg.published = TRUE
                AND pg.type != "fragment"`
        const publishedGdocsWithMalformedMarkdown = await queryRunner
            .query(malformedGdocQuery)
            .then((rows: { id: string; content: string }[]) =>
                rows.map((row) => gdocFromJSON(row))
            )

        for (const gdoc of publishedGdocsWithMalformedMarkdown) {
            const markdown = enrichedBlocksToMarkdown(gdoc.content.body, true)
            await queryRunner.query(
                `-- sql
                UPDATE posts_gdocs
                SET markdown = ?
                WHERE id = ?
            `,
                [markdown, gdoc.id]
            )
        }

        const stillMalformed = await queryRunner.query(malformedGdocQuery)
        console.warn(
            `${stillMalformed.length} malformed gdoc(s) remaining after migration`
        )
    }

    public async down(): Promise<void> {
        // no-op
    }
}
