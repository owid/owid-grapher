import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Indicator-level configs (`variables.patchConfigIdETL`) used to have a
 * `dimensions` array injected into them when stored. It was never used: a
 * chart's patch always carried its own `dimensions` (they were a "required
 * key" that survived every diff), so the indicator layer's copy always lost
 * the merge. Now that `dimensions` is an ordinary inherited property, that
 * dead array would become live — an indicator-shaped `[{y, thisVariable}]`
 * sitting underneath every inheriting chart, ready to be silently adopted.
 * Strip it.
 *
 * This is render-neutral by construction rather than by assumption. Stored
 * `full` configs are not touched, so nothing changes for readers; the only
 * risk is a chart whose *next* recompute would have to source `dimensions`
 * from the indicator layer, and step 1 pushes `dimensions` down into those
 * charts' own patches first. Multi-dim views need no such step: their patch
 * layer is derived from the mdim config on the fly (`buildMdimViewPatchConfig`)
 * and always sets `dimensions` explicitly.
 *
 * Only authored layers are rewritten (`chart_configs` rows reached via
 * `charts.patchConfigId` and `variables.patchConfigIdETL`), never a rendered
 * config, so there is nothing to re-upload to R2.
 */
export class DropDimensionsFromIndicatorConfigs1787581800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Any chart that currently gets its `dimensions` from neither its
        //    own patch nor its ETL layer would, after step 2, have nowhere left
        //    to inherit them from. Copy them from its rendered config into its
        //    patch so it keeps plotting the same indicators.
        await queryRunner.query(
            `-- sql
            UPDATE chart_configs cc_patch
            JOIN charts c ON c.patchConfigId = cc_patch.id
            JOIN chart_configs cc_full ON cc_full.id = c.configId
            LEFT JOIN chart_configs cc_etl ON cc_etl.id = c.patchConfigIdETL
            SET
                cc_patch.config = JSON_SET(
                    cc_patch.config,
                    '$.dimensions',
                    JSON_EXTRACT(cc_full.config, '$.dimensions')
                ),
                cc_patch.updatedAt = NOW()
            WHERE JSON_EXTRACT(cc_patch.config, '$.dimensions') IS NULL
              AND JSON_EXTRACT(cc_full.config, '$.dimensions') IS NOT NULL
              AND (
                  cc_etl.id IS NULL
                  OR JSON_EXTRACT(cc_etl.config, '$.dimensions') IS NULL
              )`
        )

        // 2. Drop the dead `dimensions` array from every indicator-level config.
        await queryRunner.query(
            `-- sql
            UPDATE chart_configs cc
            JOIN variables v ON v.patchConfigIdETL = cc.id
            SET
                cc.config = JSON_REMOVE(cc.config, '$.dimensions'),
                cc.updatedAt = NOW()
            WHERE JSON_EXTRACT(cc.config, '$.dimensions') IS NOT NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the single y-dimension that was injected for the indicator.
        // The original arrays aren't recoverable, but this reproduces what the
        // old injection produced for every config that didn't already name a
        // y-dimension of its own — which was all of them in practice, since the
        // array was never authored by hand. Step 1 of `up` is deliberately not
        // reversed: leaving `dimensions` in a chart's patch is harmless under
        // the old model, where the patch always carried them anyway.
        await queryRunner.query(
            `-- sql
            UPDATE chart_configs cc
            JOIN variables v ON v.patchConfigIdETL = cc.id
            SET
                cc.config = JSON_SET(
                    cc.config,
                    '$.dimensions',
                    JSON_ARRAY(JSON_OBJECT('property', 'y', 'variableId', v.id))
                ),
                cc.updatedAt = NOW()
            WHERE JSON_EXTRACT(cc.config, '$.dimensions') IS NULL`
        )
    }
}
