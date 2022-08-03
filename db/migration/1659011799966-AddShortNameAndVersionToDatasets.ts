import { MigrationInterface, QueryRunner } from "typeorm"

export class AddShortNameAndVersionToDatasets1659011799966
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE datasets
            ADD COLUMN shortName VARCHAR(255)
            DEFAULT NULL;
        `)
        await queryRunner.query(`
            ALTER TABLE datasets
            ADD COLUMN version VARCHAR(255)
            DEFAULT NULL;
        `)
        await queryRunner.query(`
            ALTER TABLE datasets ADD CONSTRAINT unique_short_name_version_namespace UNIQUE (shortName, version, namespace);
        `)

        // update shortName of all datasets from ETL
        await queryRunner.query(`
            update datasets set shortName = name
            where sourceChecksum is not null;
        `)

        // update versions of all datasets
        await queryRunner.query(
            `update datasets set version = '2020-10-01' where shortName = 'ggdc_maddison__2020_10_01';`
        )
        await queryRunner.query(
            `update datasets set version = 'latest' where shortName = 'population_density';`
        )
        await queryRunner.query(
            `update datasets set version = '2021-07-01' where shortName = 'ghe__2021_07_01';`
        )
        await queryRunner.query(
            `update datasets set version = '2022' where shortName = 'bp_statistical_review__bp_2022';`
        )
        await queryRunner.query(
            `update datasets set version = '2022' where shortName = 'bp_energy_mix__bp_2022';`
        )
        await queryRunner.query(
            `update datasets set version = '2022-07-07' where shortName = 'un_sdg__2022_07_07';`
        )
        await queryRunner.query(
            `update datasets set version = '2022-05-26' where shortName = 'wdi__2022_05_26';`
        )
        await queryRunner.query(
            `update datasets set version = '2022-07-14' where shortName = 'statistical_review__bp_2022_07_14';`
        )
        await queryRunner.query(
            `update datasets set version = '2022-07-14' where shortName = 'energy_mix__bp_2022_07_14';`
        )
        await queryRunner.query(
            `update datasets set version = '2022-07-20' where shortName = 'fossil_fuel_production__energy_2022_07_20';`
        )
        await queryRunner.query(
            `update datasets set version = '2022-07-29' where shortName = 'primary_energy_consumption__energy_2022_07_29';`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE datasets DROP INDEX unique_short_name_version_namespace;
        `)
        await queryRunner.query(`
            ALTER TABLE datasets
            DROP COLUMN shortName;
        `)
        await queryRunner.query(`
            ALTER TABLE datasets
            DROP COLUMN version;
        `)
    }
}
