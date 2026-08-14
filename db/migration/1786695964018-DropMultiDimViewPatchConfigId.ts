import { MigrationInterface, QueryRunner } from "typeorm"

export class DropMultiDimViewPatchConfigId1786695964018 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Read the ids before the column goes: afterwards nothing in the
        // database names these configs
        const orphans = await queryRunner.query(`-- sql
            SELECT patchConfigId AS id FROM multi_dim_x_chart_configs
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_x_chart_configs
            DROP FOREIGN KEY fk_multi_dim_x_chart_configs_patch_config_id
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_x_chart_configs DROP COLUMN patchConfigId
        `)

        if (orphans.length > 0) {
            await queryRunner.query(
                `DELETE FROM chart_configs WHERE id IN (?)`,
                [orphans.map((row: { id: string }) => row.id)]
            )
        }
    }

    // Restores the column, not the data
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_x_chart_configs
            ADD COLUMN patchConfigId CHAR(36)
                CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL
                AFTER chartConfigId,
            ADD UNIQUE KEY patchConfigId (patchConfigId),
            ADD CONSTRAINT fk_multi_dim_x_chart_configs_patch_config_id
                FOREIGN KEY (patchConfigId) REFERENCES chart_configs (id)
                ON DELETE RESTRICT ON UPDATE RESTRICT
        `)
    }
}
