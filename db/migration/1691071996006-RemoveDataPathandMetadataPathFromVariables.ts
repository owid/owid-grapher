import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveDataPathandMetadataPathFromVariables1691071996006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              DROP COLUMN dataPath,
              DROP COLUMN metadataPath;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              ADD COLUMN dataPath TEXT,
              ADD COLUMN metadataPath TEXT;
            `
        )

        await queryRunner.query(`
            UPDATE variables SET
                dataPath = CONCAT('https://api.ourworldindata.org/v1/indicators/', id, '.data.json'),
                metadataPath = CONCAT('https://api.ourworldindata.org/v1/indicators/', id, '.metadata.json')
            `)
    }
}
