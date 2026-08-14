import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Give charts, mdim views and narrative charts a pointer to the chart_configs
 * row holding their authored (patch) config, alongside the existing pointer to
 * their resolved one.
 *
 * Nullable, because nothing populates patchConfigId on insert yet.
 */
export class AddPatchConfigIdPointers1786450384438 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            ADD COLUMN patchConfigId char(36) NULL AFTER configId,
            ADD UNIQUE INDEX patchConfigId (patchConfigId),
            ADD CONSTRAINT fk_charts_patch_config_id FOREIGN KEY (patchConfigId)
                REFERENCES chart_configs (id) ON DELETE RESTRICT ON UPDATE RESTRICT
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_x_chart_configs
            ADD COLUMN patchConfigId char(36) NULL AFTER chartConfigId,
            ADD UNIQUE INDEX patchConfigId (patchConfigId),
            ADD CONSTRAINT fk_multi_dim_x_chart_configs_patch_config_id
                FOREIGN KEY (patchConfigId)
                REFERENCES chart_configs (id) ON DELETE RESTRICT ON UPDATE RESTRICT
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE narrative_charts
            ADD COLUMN patchConfigId char(36) NULL AFTER chartConfigId,
            ADD UNIQUE INDEX patchConfigId (patchConfigId),
            ADD CONSTRAINT fk_narrative_charts_patch_config_id
                FOREIGN KEY (patchConfigId)
                REFERENCES chart_configs (id) ON DELETE RESTRICT ON UPDATE RESTRICT
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE narrative_charts
            DROP FOREIGN KEY fk_narrative_charts_patch_config_id,
            DROP COLUMN patchConfigId
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_x_chart_configs
            DROP FOREIGN KEY fk_multi_dim_x_chart_configs_patch_config_id,
            DROP COLUMN patchConfigId
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE charts
            DROP FOREIGN KEY fk_charts_patch_config_id,
            DROP COLUMN patchConfigId
        `)
    }
}
