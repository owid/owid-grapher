import { Json } from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
    { table: "suggested_chart_revisions", column: "suggestedConfig" },
]

export class RemoveEqualSizeBins1748436369499 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove equalSizeBins from colorScale and map.colorScale for all charts
        for (const { table, column } of tables) {
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        ${column},
                        "$.colorScale.equalSizeBins",
                        "$.map.colorScale.equalSizeBins"
                    )
                    WHERE ${column} ->> "$.colorScale.equalSizeBins" IS NOT NULL
                       OR ${column} ->> "$.map.colorScale.equalSizeBins" IS NOT NULL
                `
            )
        }

        // Remove colorScaleEqualSizeBins from explorers. This cannot easily be done with JSON_REMOVE, so we need to
        // do it in JS instead.
        const deleteEqualSizeBinsFromExplorer = (config: Json): Json => {
            for (const block of config.blocks ?? []) {
                for (const props of block.block ?? []) {
                    delete props.colorScaleEqualSizeBins
                }
            }
            return config
        }

        const affectedExplorers = await queryRunner.query(
            `-- sql
                SELECT slug, config
                FROM explorers
                WHERE config LIKE "%colorScaleEqualSizeBins%"
            `
        )
        for (const { slug, config } of affectedExplorers) {
            const parsedConfig = JSON.parse(config)
            const updatedConfig = deleteEqualSizeBinsFromExplorer(parsedConfig)
            await queryRunner.query(
                `-- sql
                    UPDATE explorers
                    SET config = ?
                    WHERE slug = ?
                `,
                [JSON.stringify(updatedConfig), slug]
            )
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // intentionally left empty
    }
}
