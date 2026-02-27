import { MigrationInterface, QueryRunner } from "typeorm"

export class PopulateDatapathAndMetadatapath1678983851216 implements MigrationInterface {
    // production DB does not have NULL fields, but staging servers still might
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        update variables
            set dataPath = CONCAT('https://api.ourworldindata.org/v1/indicators/', id, '.data.json')
            where dataPath is null
        `)
        await queryRunner.query(`-- sql
        update variables
            set metadataPath = CONCAT('https://api.ourworldindata.org/v1/indicators/', id, '.metadata.json')
            where metadataPath is null
        `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
