import { OwidGdocPostContent } from "@ourworldindata/types"
import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateGdocPullquotes1747953356597 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // We have 2 of these in prod. Easier to remove them and republish the documents than
        // to try to fix them in the database with a generic migration that can position the pull-quotes correctly.
        const publishedGdocsWithPullquotes = (await queryRunner.query(`-- sql
            SELECT id, content
            FROM posts_gdocs
            WHERE content LIKE "%pull-quote%"
            AND published = TRUE
        `)) as { id: string; content: string }[]

        for (const gdoc of publishedGdocsWithPullquotes) {
            const parsed = JSON.parse(gdoc.content) as OwidGdocPostContent
            if (!parsed.body) {
                console.log(
                    `Gdoc ${gdoc.id} does not have a body. Skipping pull-quote migration.`
                )
                continue
            }
            const remade: OwidGdocPostContent = {
                ...parsed,
                body: parsed.body.filter(
                    (block) => block.type !== "pull-quote"
                ),
            }

            const newContent = JSON.stringify(remade)
            await queryRunner.query(
                `UPDATE posts_gdocs SET content = ? WHERE id = ?`,
                [newContent, gdoc.id]
            )
        }
    }

    public async down(): Promise<void> {
        // no-op
    }
}
