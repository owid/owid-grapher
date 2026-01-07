import { MigrationInterface, QueryRunner } from "typeorm"

export class AddSearchableInAlgoliaToTags1767820831537
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE tags
            ADD COLUMN searchableInAlgolia BOOLEAN NOT NULL DEFAULT FALSE
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE tags
            DROP COLUMN searchableInAlgolia
        `)
    }
}
