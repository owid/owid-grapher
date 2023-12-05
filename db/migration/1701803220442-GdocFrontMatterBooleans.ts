import { MigrationInterface, QueryRunner } from "typeorm"

export class GdocFrontMatterBooleans1701803220442
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const gdocs: { id: string; content: string }[] =
            await queryRunner.query(
                `SELECT id, content FROM posts_gdocs WHERE published = TRUE AND (content LIKE '%"true"%' OR content LIKE '%"false"%')`
            )

        for (const gdoc of gdocs) {
            const content = JSON.parse(gdoc.content)
            for (const [key, value] of Object.entries(content)) {
                if (typeof value === "string") {
                    if (value === "true") {
                        content[key] = true
                    } else if (value === "false") {
                        content[key] = false
                    }
                }
            }
            await queryRunner.query(
                `UPDATE posts_gdocs SET content = ? WHERE id = ?`,
                [JSON.stringify(content), gdoc.id]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const gdocs: { id: string; content: string }[] =
            await queryRunner.query(
                `SELECT id, content FROM posts_gdocs WHERE published = TRUE AND (content LIKE '%: true%' OR content LIKE '%: false%')`
            )
        for (const gdoc of gdocs) {
            const content = JSON.parse(gdoc.content)
            for (const [key, value] of Object.entries(content)) {
                if (typeof value === "boolean") {
                    content[key] = value ? "true" : "false"
                }
            }
            await queryRunner.query(
                `UPDATE posts_gdocs SET content = ? WHERE id = ?`,
                [JSON.stringify(content), gdoc.id]
            )
        }
    }
}
