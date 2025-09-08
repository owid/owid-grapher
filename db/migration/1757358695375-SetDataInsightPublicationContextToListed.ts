import { MigrationInterface, QueryRunner } from "typeorm"

export class SetDataInsightPublicationContextToListed1757358695375
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE posts_gdocs pg
            SET pg.publicationContext = "listed"
            WHERE type = "data-insight"
            AND publicationContext = "unlisted";
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE posts_gdocs pg
            SET pg.publicationContext = "unlisted"
            WHERE type = "data-insight"
            AND publicationContext = "listed";
        `)
    }
}
