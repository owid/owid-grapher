import { MigrationInterface, QueryRunner } from "typeorm"

export class AddMissingSchemaURLsToConfigs1689156258161
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = {
            suggested_chart_revisions: "suggestedConfig",
            chart_revisions: "config",
            charts: "config",
        }

        for (const [tableName, columnName] of Object.entries(tables)) {
            // updates the $schema field of all configs to the current schema url https://files.ourworldindata.org/schemas/grapher-schema.003.json
            // (not all configs are missing this field, but it's easier to just update all of them)
            await queryRunner.query(
                `update ${tableName} set ${columnName} = JSON_SET(${columnName}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.003.json")`
            )
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return // es-lint complains on empty async functions
    }
}
