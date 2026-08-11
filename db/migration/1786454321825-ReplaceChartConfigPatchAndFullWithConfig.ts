import { MigrationInterface, QueryRunner } from "typeorm"

// Owners that keep their authored config in a chart_configs row of their own
const OWNERS = [
    { table: "charts", resolvedPointer: "configId" },
    { table: "multi_dim_x_chart_configs", resolvedPointer: "chartConfigId" },
    { table: "narrative_charts", resolvedPointer: "chartConfigId" },
] as const

const CHARTS_X_PARENTS_VIEW = `-- sql
    ALTER VIEW charts_x_parents AS (
      WITH y_dimensions AS (
        SELECT * FROM chart_dimensions WHERE property = 'y'
      ),
      single_y_indicator_charts AS (
        SELECT
          c.id as chartId,
          -- should only be one
          max(yd.variableId) as variableId
        FROM charts c
          JOIN chart_configs cc ON cc.id = c.configId
          JOIN y_dimensions yd ON c.id = yd.chartId
        WHERE
          -- scatter plots can't inherit settings
          -- NULL chartType means no chart tab (chartTypes=[]), which should be included
          (cc.chartType != 'ScatterPlot' OR cc.chartType IS NULL)
        GROUP BY c.id
        HAVING
          -- restrict to single y-variable charts
          COUNT(distinct yd.variableId) = 1
      )
      SELECT variableId, chartId FROM single_y_indicator_charts ORDER BY variableId
    )
`

/**
 * Replace chart_configs.patch + full with a single `config` column. A row now
 * holds one config, and which layer it is follows from the pointer that names it:
 * `configId` for the config that renders, `patchConfigId*` for an authored layer.
 *
 * The steps are ordered around three MySQL constraints:
 *   - a column cannot be renamed while a generated column depends on it, and all
 *     three of ours are STORED over `full`, so they come off first and go back on
 *     over `config`;
 *   - a view's columns are validated when it is created, so the charts_x_parents
 *     view loses its `patch` reference before the column goes, and stays patch-free
 *     after down() — this was a dead reference anyway
 *   - adding a STORED generated column is the one operation here that blocks
 *     writes, so `patch` is dropped in the earlier, non-blocking rebuild and the
 *     three columns and the index share the blocking one: it then copies a table
 *     that no longer carries a duplicate config per row.
 */
export class ReplaceChartConfigPatchAndFullWithConfig1786454321825 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the patch config from the charts_x_parents view (it was a dead reference anyway)
        await queryRunner.query(CHARTS_X_PARENTS_VIEW)

        // For admin-authored indicator config, `patch` holds the authored config,
        // `full` is merged with the ETL layer. We want to keep the authored config
        // in the new `config` column, so copy it over. No need to do this for
        // the ETL layer, since patch and full are identical there.
        await queryRunner.query(`-- sql
            UPDATE chart_configs cc
            JOIN variables v ON v.grapherConfigIdAdmin = cc.id
            SET cc.\`full\` = cc.patch
        `)

        // Drop the patch column and all three generated columns that depend on `full`
        // Dropping slug also drops idx_chart_configs_slug
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs
            DROP COLUMN slug,
            DROP COLUMN chartType,
            DROP COLUMN fullMd5,
            DROP COLUMN patch
        `)

        // Rename `full` to `config`
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs RENAME COLUMN \`full\` TO config
        `)

        // Add back the three generated columns, now over `config`, and the index on slug
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs
            ADD COLUMN slug varchar(255)
                GENERATED ALWAYS AS (json_unquote(json_extract(config, '$.slug'))) STORED
                AFTER config,
            ADD COLUMN chartType varchar(255)
                GENERATED ALWAYS AS ((case
                    when (json_unquote(json_extract(config, '$.chartTypes')) is null)
                    then 'LineChart'
                    else json_unquote(json_extract(config, '$.chartTypes[0]'))
                end)) STORED
                AFTER slug,
            ADD COLUMN configMd5 char(24)
                GENERATED ALWAYS AS (to_base64(unhex(md5(config)))) STORED NOT NULL,
            ADD INDEX idx_chart_configs_slug (slug)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Nullable to begin with, since it is filled in two passes.
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs ADD COLUMN patch json NULL AFTER id
        `)

        // For owners that keep an authored config, patch comes back from the row
        // holding it.
        for (const { table, resolvedPointer } of OWNERS) {
            await queryRunner.query(`-- sql
                UPDATE chart_configs resolved
                JOIN ${table} o ON o.${resolvedPointer} = resolved.id
                JOIN chart_configs patch ON patch.id = o.patchConfigId
                SET resolved.patch = patch.config
            `)
        }

        // Everything else — indicator configs, explorer views, and the authored
        // rows themselves — held patch identical to full.
        await queryRunner.query(`-- sql
            UPDATE chart_configs SET patch = config WHERE patch IS NULL
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs MODIFY COLUMN patch json NOT NULL
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs
            DROP COLUMN slug,
            DROP COLUMN chartType,
            DROP COLUMN configMd5
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs RENAME COLUMN config TO \`full\`
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs
            ADD COLUMN slug varchar(255)
                GENERATED ALWAYS AS (json_unquote(json_extract(\`full\`, '$.slug'))) STORED
                AFTER \`full\`,
            ADD COLUMN chartType varchar(255)
                GENERATED ALWAYS AS ((case
                    when (json_unquote(json_extract(\`full\`, '$.chartTypes')) is null)
                    then 'LineChart'
                    else json_unquote(json_extract(\`full\`, '$.chartTypes[0]'))
                end)) STORED
                AFTER slug,
            ADD COLUMN fullMd5 char(24)
                GENERATED ALWAYS AS (to_base64(unhex(md5(\`full\`)))) STORED NOT NULL,
            ADD INDEX idx_chart_configs_slug (slug)
        `)
    }
}
