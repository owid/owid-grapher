import { MigrationInterface, QueryRunner } from "typeorm"

export class BackfillExplorerAndMultiDimViewDimensions1769077301485 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            INSERT INTO explorer_view_dimensions (chartConfigId, dimensions)
            SELECT chartConfigId, dimensions
            FROM explorer_views
            WHERE chartConfigId IS NOT NULL
        `)

        await queryRunner.query(`-- sql
            INSERT INTO multi_dim_view_dimensions (chartConfigId, dimensions)
            SELECT jt.fullConfigId, jt.dimensions
            FROM multi_dim_data_pages mdp
            JOIN JSON_TABLE(
                mdp.config,
                "$.views[*]" COLUMNS (
                    fullConfigId VARCHAR(36) PATH "$.fullConfigId",
                    dimensions JSON PATH "$.dimensions"
                )
            ) jt ON TRUE
            WHERE jt.fullConfigId IS NOT NULL
                AND jt.dimensions IS NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE FROM multi_dim_view_dimensions
        `)

        await queryRunner.query(`-- sql
            DELETE FROM explorer_view_dimensions
        `)
    }
}
