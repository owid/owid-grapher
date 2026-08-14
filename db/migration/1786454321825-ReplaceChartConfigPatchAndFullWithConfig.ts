import { MigrationInterface, QueryRunner } from "typeorm"

// Owners that keep their authored config in a chart_configs row of their own.
// Used by the down migration to put `patch` back from those rows.
const OWNERS = [
    { table: "charts", resolvedPointer: "configId" },
    { table: "multi_dim_x_chart_configs", resolvedPointer: "chartConfigId" },
    { table: "narrative_charts", resolvedPointer: "chartConfigId" },
] as const

const chartsXParentsView = ({
    withPatchConfig,
}: {
    withPatchConfig: boolean
}): string => `-- sql
    ALTER VIEW charts_x_parents AS (
      WITH y_dimensions AS (
        SELECT * FROM chart_dimensions WHERE property = 'y'
      ),
      single_y_indicator_charts AS (
        SELECT
          c.id as chartId,${withPatchConfig ? "\n          cc.patch as patchConfig," : ""}
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
 * The authored layer already lives in rows of its own (see the migration that
 * added patchConfigId), so dropping `patch` here moves no information — which is
 * what makes this reversible, and the down migration reconstructs the column from
 * those rows.
 *
 * The steps are ordered around three MySQL constraints:
 *   - a column cannot be renamed while a generated column depends on it, and all
 *     three of ours are STORED over `full`, so they come off first and go back on
 *     over `config`;
 *   - a view's columns are validated when it is created, so the view loses its
 *     `patch` reference before the column goes and regains it only after `patch`
 *     and `chartType` are both back;
 *   - adding a STORED generated column is the one operation here that blocks
 *     writes, so the drop, the three columns and the index share a single ALTER —
 *     that pays the table copy once, and the copy reclaims the space `patch` used,
 *     so no separate OPTIMIZE TABLE is needed.
 */
export class ReplaceChartConfigPatchAndFullWithConfig1786454321825 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // The CTE selected cc.patch but the outer SELECT never projected it, so
        // dropping the reference changes nothing downstream.
        await queryRunner.query(chartsXParentsView({ withPatchConfig: false }))

        // Snapshot the hashes while `full` is still intact. The claim that no
        // config hash moves — no archive re-bake, no R2 re-upload, no phantom
        // chart-diffs — is asserted below, and this is the only point at which the
        // before-state can still be captured.
        await queryRunner.query(`-- sql
            CREATE TABLE tmpChartConfigMd5Before (
                id char(36) NOT NULL PRIMARY KEY,
                fullMd5 char(24) NOT NULL
            )
        `)
        await queryRunner.query(`-- sql
            INSERT INTO tmpChartConfigMd5Before (id, fullMd5)
            SELECT id, fullMd5 FROM chart_configs
        `)

        // Dropping slug takes idx_chart_configs_slug with it.
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs
            DROP COLUMN slug,
            DROP COLUMN chartType,
            DROP COLUMN fullMd5
        `)

        // Rename `full` to `config`
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs RENAME COLUMN \`full\` TO config
        `)

        // The expressions are today's, verbatim, with `full` → `config`; keeping
        // them identical is what makes the assertion below hold.
        await queryRunner.query(`-- sql
            ALTER TABLE chart_configs
            DROP COLUMN patch,
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

        await this.assertNoHashesMoved(queryRunner)

        await queryRunner.query(`-- sql
            DROP TABLE tmpChartConfigMd5Before
        `)
    }

    /**
     * Config UUIDs are public and several of the places they appear cannot be
     * taken back — archived pages, analytics history, Algolia records, copied URLs
     * — so a row's bytes have to come through this untouched. Anything else means
     * re-uploading every R2 object and a phantom chart-diff for every chart.
     */
    private async assertNoHashesMoved(queryRunner: QueryRunner): Promise<void> {
        const [{ moved }] = await queryRunner.query(`-- sql
            SELECT COUNT(*) AS moved
            FROM chart_configs cc
            JOIN tmpChartConfigMd5Before prev ON prev.id = cc.id
            WHERE cc.configMd5 <> prev.fullMd5
        `)
        if (Number(moved) > 0) {
            throw new Error(
                `${moved} chart configs changed hash while replacing patch/full with config`
            )
        }

        // A row present before but missing after would slip past the join above.
        const [{ missing }] = await queryRunner.query(`-- sql
            SELECT COUNT(*) AS missing
            FROM tmpChartConfigMd5Before prev
            WHERE NOT EXISTS (
                SELECT 1 FROM chart_configs cc WHERE cc.id = prev.id
            )
        `)
        if (Number(missing) > 0) {
            throw new Error(
                `${missing} chart configs disappeared while replacing patch/full with config`
            )
        }
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

        // Restore the cc.patch reference. Only legal now that both patch and
        // chartType are back, since MySQL validates a view's columns on creation.
        await queryRunner.query(chartsXParentsView({ withPatchConfig: true }))

        // Left behind only if up() failed between creating it and dropping it.
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS tmpChartConfigMd5Before
        `)
    }
}
