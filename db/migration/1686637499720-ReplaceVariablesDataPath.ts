import { MigrationInterface, QueryRunner } from "typeorm"

export class ReplaceVariablesDataPath1686637499720 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            UPDATE variables
            SET dataPath = REPLACE(
                REPLACE(
                    dataPath,
                    'https://catalog.ourworldindata.org/baked-variables/live_grapher/data/',
                    'https://api.ourworldindata.org/v1/indicators/'
                ),
                '.json',
                '.data.json'
            ), metadataPath = REPLACE(
                REPLACE(
                    metadataPath,
                    'https://catalog.ourworldindata.org/baked-variables/live_grapher/metadata/',
                    'https://api.ourworldindata.org/v1/indicators/'
                ),
                '.json',
                '.metadata.json'
            );
            `
        )
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<any> {}
}
