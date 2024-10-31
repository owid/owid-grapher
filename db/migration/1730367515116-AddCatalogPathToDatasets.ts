import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCatalogPathToDatasets1730367515116
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DROP INDEX `unique_short_name_version_namespace` ON `datasets`"
        )
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD COLUMN `catalogPath` VARCHAR(767) NULL DEFAULT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD COLUMN `tables` JSON NULL DEFAULT NULL"
        )
        await queryRunner.query(
            "CREATE UNIQUE INDEX `datasets_catalogpath` ON `datasets` (`catalogPath`)"
        )
        await queryRunner.query(`
            UPDATE \`datasets\`
            SET \`catalogPath\` = CONCAT(\`namespace\`, '/', \`version\`, '/', \`shortName\`)
            WHERE \`catalogPath\` IS NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DROP INDEX `datasets_catalogpath` ON `datasets`"
        )
        await queryRunner.query(
            "ALTER TABLE `datasets` DROP COLUMN `catalogPath`"
        )
        await queryRunner.query("ALTER TABLE `datasets` DROP COLUMN `tables`")
        await queryRunner.query(
            "CREATE UNIQUE INDEX `unique_short_name_version_namespace` ON `datasets` (`shortName`, `version`, `namespace`)"
        )
    }
}
