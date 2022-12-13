import { MigrationInterface, QueryRunner } from "typeorm"

export class AddWordpressPostArchieMlJsonColumn1666871402674
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`-- sql
            ALTER TABLE posts
            ADD COLUMN archieml json AFTER content,
            ADD COLUMN archieml_update_statistics json AFTER archieml
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`-- sql
            ALTER TABLE posts
            DROP COLUMN archieml,
            DROP COLUMN archieml_update_statistics
        `)
    }
}
