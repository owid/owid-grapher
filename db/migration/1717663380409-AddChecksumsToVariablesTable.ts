import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChecksumsToVariablesTable1717663380409
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        ALTER TABLE variables
            ADD COLUMN dataChecksum VARCHAR(64),
            ADD COLUMN metadataChecksum VARCHAR(64);`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        ALTER TABLE variables
            DROP COLUMN dataChecksum,
            DROP COLUMN metadataChecksum;`)
    }
}
