import { MigrationInterface, QueryRunner } from "typeorm"

const TABLES = ["charts", "multi_dim_x_chart_configs", "narrative_charts"]

/**
 * Every chart, mdim view and narrative chart keeps its authored config in a row
 * of its own, so require the pointer to it.
 */
export class RequirePatchConfigIdPointers1786450392200 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of TABLES) {
            await queryRunner.query(`-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN patchConfigId char(36) NOT NULL
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of TABLES) {
            await queryRunner.query(`-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN patchConfigId char(36) NULL
            `)
        }
    }
}
