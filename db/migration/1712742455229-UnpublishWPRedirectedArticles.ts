import { MigrationInterface, QueryRunner } from "typeorm"

export class UnpublishRedirectedWPArticles1712742455229
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        UPDATE posts p
        INNER JOIN redirects r ON r.source = CONCAT("/", p.slug)
        SET status        = "private",
            wpApiSnapshot = JSON_SET(wpApiSnapshot, "$.status", "private")
        WHERE p.status = "publish"
          AND p.content != ""`)
    }

    public async down(): Promise<void> {
        // empty
    }
}
