import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsLinksDisplayOrder1697464705200
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_variables_faqs
            ADD COLUMN displayOrder SMALLINT NOT NULL DEFAULT 0;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_variables_faqs
            DROP COLUMN displayOrder;`
        )
    }
}
