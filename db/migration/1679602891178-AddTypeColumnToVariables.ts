import { MigrationInterface, QueryRunner } from "typeorm"

export class AddTypeColumnToVariables1679602891178
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
        ALTER TABLE variables
        ADD COLUMN type JSON;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
        ALTER TABLE variables
        DROP COLUMN type;
        `)
    }
}
