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
