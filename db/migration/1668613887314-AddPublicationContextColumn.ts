import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPublicationContextColumn1668613887314
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts_gdocs
        ADD COLUMN publicationContext ENUM('unlisted', 'listed') NOT NULL DEFAULT 'unlisted'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts_gdocs
        DROP COLUMN publicationContext
        `)
    }
}
