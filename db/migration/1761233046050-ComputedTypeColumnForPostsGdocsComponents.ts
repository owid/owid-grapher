import { MigrationInterface, QueryRunner } from "typeorm"

export class ComputedTypeColumnForPostsGdocsComponents1761233046050 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_components
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(config, '$.type'))) STORED AFTER gdocId
        `)

        await queryRunner.query(`-- sql
            CREATE INDEX idx_gdocs_components_type ON posts_gdocs_components (type)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_gdocs_components_type ON posts_gdocs_components
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_components
            DROP COLUMN type
        `)
    }
}
