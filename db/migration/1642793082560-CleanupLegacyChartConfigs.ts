import { MigrationInterface, QueryRunner } from "typeorm"

export class CleanupLegacyChartConfigs1642793082560
    implements MigrationInterface
{
    async migrateChartsInTable(
        queryRunner: QueryRunner,
        table: string,
        column: string
    ): Promise<void> {
        const migrations: string[] = [
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."isColorblind"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."isColorblind"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."variables"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."variables"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."timelineMode"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."timelineMode"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."minYear"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."minYear"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."chart-notes"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."chart-notes"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."iframe-height"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."iframe-height"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."/charts/255"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."/charts/255"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."iframe-width"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."iframe-width"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."activeLegendKeys"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."activeLegendKeys"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."chart-name"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."chart-name"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."mode"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."mode"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."targetYearMode"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."targetYearMode"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."useV2"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."useV2"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."yAxis"."labelDistance"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."yAxis"."labelDistance"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."legendOrientation"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."legendOrientation"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."/charts/29"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."/charts/29"') = 1;`,
            // -- `update ${table}
            // -- set ${column} = JSON_REMOVE(${column}, '$."isExplorable"')
            // -- where JSON_CONTAINS_PATH(${column}, 'one', '$."isExplorable"') = 1;`
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."lastEditedAt"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."lastEditedAt"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."timeline"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."timeline"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."published"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."published"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."group-by-variables"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."group-by-variables"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."margins"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."margins"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."add-country-control"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."add-country-control"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."logos"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."logos"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."units"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."units"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."defaultProjection"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."defaultProjection"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."legendStepSize"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."legendStepSize"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."identityLine"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."identityLine"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."isAutoSlug"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."isAutoSlug"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."onlyEntityMatch"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."onlyEntityMatch"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."isAutoTitle"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."isAutoTitle"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."colorSchemeName"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."colorSchemeName"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."timeRanges"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."timeRanges"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."highlightToggle"."object"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."highlightToggle"."object"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."defaultYear"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."defaultYear"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."chart-slug"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."chart-slug"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."maxYear"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."maxYear"') = 1;`,

            // -- second batch
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."map"."timeInterval"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."map"."timeInterval"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."xAxis"."labelDistance"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."xAxis"."labelDistance"') = 1;`,

            `update ${table}
set ${column} = JSON_SET(${column}, '$.map.targetYear', convert(${column}->>"$.map.targetYear", signed integer))
where JSON_TYPE(JSON_EXTRACT(${column}, '$.map.targetYear')) = 'STRING' and
JSON_EXTRACT(${column}, '$.map.targetYear') <> "latest"`,

            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.stackMode')
where JSON_EXTRACT(${column}, '$.stackMode') = '' or JSON_EXTRACT(${column}, '$.stackMode') = 'null' or JSON_EXTRACT(${column}, '$.stackMode') = 'grouped' or JSON_EXTRACT(${column}, '$.stackMode') = 'stacked' or JSON_EXTRACT(${column}, '$.stackMode') = '
undefined'`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."highlightToggle"')
where JSON_CONTAINS_PATH(${column}, 'one', '$.highlightToggle ') = 1 and JSON_TYPE(JSON_EXTRACT(${column}, '$.highlightToggle')) = 'NULL'`,

            // -- third batch
            // -- these fields are now objects but some older ${column}s had array. These can't be parsed correctly anymore so we drop them.
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.map.colorScale.customCategoryColors')
where JSON_CONTAINS_PATH(${column}, 'one', '$.map.colorScale.customCategoryColors') = 1
and JSON_TYPE(JSON_EXTRACT(${column}, '$.map.colorScale.customCategoryColors')) = 'ARRAY'`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.map.colorScale.customHiddenCategories')
where JSON_CONTAINS_PATH(${column}, 'one', '$.map.colorScale.customHiddenCategories') = 1
and JSON_TYPE(JSON_EXTRACT(${column}, '$.map.colorScale.customHiddenCategories')) = 'ARRAY'`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.map.colorScale.customCategoryLabels')
where JSON_CONTAINS_PATH(${column}, 'one', '$.map.colorScale.customCategoryLabels') = 1
and JSON_TYPE(JSON_EXTRACT(${column}, '$.map.colorScale.customCategoryLabels')) = 'ARRAY'`,

            // -- fourth batch
            // -- fields that are used quite a lot but are no longer parsed
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."xAxis"."suffix"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."xAxis"."suffix"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."xAxis"."prefix"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."xAxis"."prefix"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."yAxis"."suffix"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."yAxis"."suffix"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."yAxis"."prefix"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."yAxis"."prefix"') = 1;`,

            `update ${table}
set ${column} = JSON_SET(${column}, '$.map.time', ${column}->>'$.map.targetYear')
where JSON_CONTAINS_PATH(${column}, 'one', '$.map.targetYear')`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.map.targetYear')
where JSON_CONTAINS_PATH(${column}, 'one', '$.map.targetYear')`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.originUrl')
where JSON_CONTAINS_PATH(${column}, 'one', '$.originUrl') = 1 and JSON_TYPE(JSON_EXTRACT(${column}, '$.originUrl')) = 'NULL'`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$.isPublished')
where JSON_CONTAINS_PATH(${column}, 'one', '$.isPublished') = 1 and JSON_TYPE(JSON_EXTRACT(${column}, '$.isPublished')) = 'NULL'`,

            `update ${table}
set ${column} = JSON_SET(${column}, '$.map.time', convert(JSON_EXTRACT(${column}, '$.map.time'), SIGNED))
where JSON_CONTAINS_PATH(${column}, 'one', '$.map.time') = 1 and JSON_TYPE(JSON_EXTRACT(${column}, '$.map.time')) = 'STRING' and JSON_EXTRACT(${column}, '$.map.time') <> 'latest'`,

            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."xAxis"."numDecimalPlaces"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."xAxis"."numDecimalPlaces"') = 1;`,
            `update ${table}
set ${column} = JSON_REMOVE(${column}, '$."yAxis"."numDecimalPlaces"')
where JSON_CONTAINS_PATH(${column}, 'one', '$."yAxis"."numDecimalPlaces"') = 1;`,
        ]

        for (const migration of migrations) {
            await queryRunner.query(migration)
        }
    }

    async migrateDimensionsValues(
        queryRunner: QueryRunner,
        table: string,
        column: string
    ): Promise<void> {
        const rows = await queryRunner.query(`select id, ${column} as config
        from ${table}
        where JSON_CONTAINS_PATH(${column}, 'one', '$.dimensions[*].order') = 1
        or JSON_CONTAINS_PATH(${column}, 'one', '$.dimensions[*].id') = 1
        or JSON_CONTAINS_PATH(${column}, 'one', '$.dimensions[*].chartId') = 1
        or JSON_CONTAINS_PATH(${column}, 'one', '$.dimensions[*].numDecimalPlaces') = 1`)
        for (const row of rows) {
            const id = row.id
            const json: any = JSON.parse(row.config)
            for (const dimension in json.dimensions) {
                delete (dimension as any).order
                delete (dimension as any).id
                delete (dimension as any).chartId
                delete (dimension as any).numDecimalPlaces
            }
            queryRunner.query(
                `update ${table} set ${column} = ? where id = ?`,
                [JSON.stringify(json), id]
            )
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await this.migrateChartsInTable(queryRunner, "charts", "config")
            await this.migrateChartsInTable(
                queryRunner,
                "suggested_chart_revisions",
                "suggestedConfig"
            )

            await this.migrateDimensionsValues(queryRunner, "charts", "config")
            await this.migrateDimensionsValues(
                queryRunner,
                "suggested_chart_revisions",
                "suggestedConfig"
            )
        } catch (ex) {
            console.error("Encountered an error during migration: ", ex)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration is not really undo-able unless we would create a backup table to hold the old
        // chart ${column}s which is probably not worth it
    }
}
