import { MigrationInterface, QueryRunner } from "typeorm"

export class AddDataPathToVariables1676024933829 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              ADD COLUMN dataPath TEXT,
              ADD COLUMN metadataPath TEXT;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              DROP COLUMN dataPath,
              DROP COLUMN metadataPath;
            `
        )
    }
}
