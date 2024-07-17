import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameIsIndexableColumn1720173993285
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            RENAME COLUMN is_indexable TO isIndexable
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            RENAME COLUMN isIndexable TO is_indexable
        `)
    }
}
