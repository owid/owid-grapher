import { excludeNullish } from "@ourworldindata/utils"
import { concat, zip } from "lodash"
import { MigrationInterface, QueryRunner } from "typeorm"
import { enrichedBlocksToMarkdown } from "../model/Gdoc/enrichedToMarkdown.js"

export class AddMarkdownColumns1702059907881 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // add a text column to the posts table
        await queryRunner.query("ALTER TABLE posts ADD COLUMN markdown TEXT")
        // add a text column to the posts_gdocs table
        await queryRunner.query(
            "ALTER TABLE posts_gdocs ADD COLUMN markdown TEXT"
        )

        const archieMlInGdocs = await queryRunner.query(
            `SELECT id,
            content ->> '$.body' as body,
            content ->> '$.details' as details,
            content ->> '$.faqs' as faqs,
            content ->> '$.refs' as refs
            from posts_gdocs`
        )
        const archieMlBlocks = zip(
            archieMlInGdocs.map((row: any) => row.id),
            archieMlInGdocs.map((row: any) => row.body),
            archieMlInGdocs.map((row: any) => row.details),
            archieMlInGdocs.map((row: any) => row.faqs),
            archieMlInGdocs.map((row: any) => row.refs)
        ).map((row) =>
            concat(
                excludeNullish<string>(row.slice(1) as string[]).map(
                    (blocks: string) => JSON.parse(blocks)
                )
            )
        )

        for (const row of archieMlBlocks) {
            const markdown = enrichedBlocksToMarkdown(row, true)
            console.log(markdown)
            break
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // drop the text column from the posts table
        await queryRunner.query("ALTER TABLE posts DROP COLUMN markdown")
        // drop the text column from the posts_gdocs table
        await queryRunner.query("ALTER TABLE posts_gdocs DROP COLUMN markdown")
    }
}
