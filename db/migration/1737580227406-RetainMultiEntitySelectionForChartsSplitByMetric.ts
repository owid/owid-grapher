import { MigrationInterface, QueryRunner } from "typeorm"

// As part of the migration, we'll update all charts that are split by metric
// and have a 'change-country' setting to use the 'add-country' setting instead.
// These charts should be excluded from the migration since the 'change-country'
// is more appropriate for them.
const slugs = [
    "cancer-death-rates-by-age",
    "neonatal-deaths-by-cause",
    "dealing-with-anxiety-depression-approaches",
    "mental-illness-estimated-cases",
    "deaths-from-cardiovascular-disease-type",
    "country-level-monthly-temperature-anomalies",
    "summer-temperature-anomalies",
    "winter-temperature-anomalies",
    "autumn-temperature-anomalies",
    "spring-temperature-anomalies",
    "5-year-survival-rate-of-cancers-among-female-patients-in-england",
]

export class RetainMultiEntitySelectionForChartsSplitByMetric1737580227406
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Charts faceted by metric used to ignore the 'change-country' setting
        // and offer multi-entity selection always. The code change that comes
        // with this migration makes it so that the 'change-country' setting
        // is respected. This migration updates all existing charts that relied
        // on the old behavior to use the 'add-country' setting explicitly.
        await queryRunner.query(
            `
            UPDATE chart_configs
            SET
                patch = JSON_SET(patch, '$.addCountryMode', 'add-country'),
                full = JSON_SET(full, '$.addCountryMode', 'add-country')
            WHERE
                full ->> '$.addCountryMode' = 'change-country'
                AND full ->> '$.selectedFacetStrategy' = 'metric'
                AND slug NOT IN (?);
        `,
            [slugs]
        )
    }

    public async down(): Promise<void> {
        // no-op
    }
}
