import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveStickyNavLinks1749844475237 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const gdocsWithStickyNavLinks = (await queryRunner.query(`-- sql
            SELECT
           	    id,
               	content
            FROM
           	    posts_gdocs
            WHERE
               	content->>'$."sticky-nav"' IS NOT NULL
               	AND published = TRUE
        `)) as { id: string; content: string }[]

        const idsToRemove = [
            "#article-citation",
            "#article-licence",
            "#article-endnotes",
        ]

        for (const gdoc of gdocsWithStickyNavLinks) {
            const parsed = JSON.parse(gdoc.content) as {
                "sticky-nav": { target: string }[]
            }
            const stickyNav = parsed["sticky-nav"]
            if (stickyNav) {
                const newStickyNav = stickyNav.filter(
                    (link) => !idsToRemove.includes(link.target)
                )
                parsed["sticky-nav"] = newStickyNav
                await queryRunner.query(
                    `-- sql
                    UPDATE posts_gdocs SET content = ? WHERE id = ?`,
                    [JSON.stringify(parsed), gdoc.id]
                )
            }
        }
    }

    public async down(_: QueryRunner): Promise<void> {
        // no-op
    }
}
