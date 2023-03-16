import { MigrationInterface, QueryRunner } from "typeorm"

export class PopulateDatapathAndMetadatapath1678983851216
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        update variables
            set dataPath = CONCAT('https://catalog.ourworldindata.org/baked-variables/live_grapher/data/', id, '.json')
            where dataPath is null
        `)
        await queryRunner.query(`-- sql
        update variables
            set dataPath = CONCAT('https://catalog.ourworldindata.org/baked-variables/live_grapher/metadata/', id, '.json')
            where metadataPath is null
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
