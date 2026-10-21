import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * fparser v4 no longer parses implicit multiplication (`2x`) or decimals
 * without a leading zero (`.5*x`). These are the only comparison line
 * formulas in use that rely on either, so rewrite them to an equivalent
 * form that both v3 and v4 understand.
 *
 * Both the rendered config (`charts.configId`) and the editor-authored layer
 * (`charts.patchConfigId`) of each chart carry the formula, so both are
 * rewritten. Rendered configs are mirrored to R2, so run
 * `yarn syncGraphersToR2` afterwards.
 */
const FORMULA_REWRITES: { chartId: number; from: string; to: string }[] = [
    { chartId: 2373, from: "2x", to: "2*x" },
    { chartId: 3115, from: "13.23964-.7843455*x", to: "13.23964-0.7843455*x" },
    ...[3303, 4136].map((chartId) => ({
        chartId,
        from: "28.47107+.0023278*x-0.0000000416*x*x+0.000000000000262*x*x*x",
        to: "28.47107+0.0023278*x-0.0000000416*x*x+0.000000000000262*x*x*x",
    })),
    ...[".4*x", ".2*x", ".5*x", ".6*x"].map((from) => ({
        chartId: 4450,
        from,
        to: `0${from}`,
    })),
]

async function rewriteFormula(
    queryRunner: QueryRunner,
    chartId: number,
    from: string,
    to: string
): Promise<void> {
    // MySQL serialises JSON objects as `"key": "value"`, so matching the
    // whole key-value pair only ever touches the yEquals field
    const fromPair = `"yEquals": ${JSON.stringify(from)}`
    const toPair = `"yEquals": ${JSON.stringify(to)}`
    await queryRunner.query(
        `-- sql
        UPDATE chart_configs cc
        JOIN charts c ON cc.id IN (c.configId, c.patchConfigId)
        SET
            cc.config = CAST(
                REPLACE(CAST(cc.config AS CHAR), ?, ?) AS JSON
            ),
            cc.updatedAt = NOW()
        WHERE c.id = ?
          AND JSON_SEARCH(cc.config, 'one', ?, NULL, '$.comparisonLines[*].yEquals') IS NOT NULL`,
        [fromPair, toPair, chartId, from]
    )
}

export class MakeComparisonLineFormulasFparser4Compatible1792571316635 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { chartId, from, to } of FORMULA_REWRITES)
            await rewriteFormula(queryRunner, chartId, from, to)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { chartId, from, to } of FORMULA_REWRITES)
            await rewriteFormula(queryRunner, chartId, to, from)
    }
}
