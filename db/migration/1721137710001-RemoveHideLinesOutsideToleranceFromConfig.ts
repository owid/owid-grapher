import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveHideLinesOutsideToleranceFromConfig1721137710001
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_REMOVE(config, '$."hideLinesOutsideTolerance"')
            WHERE
                type = "ScatterPlot"
            AND
                slug IN (
                  "stunting-vs-level-of-prosperity-over-time",
                  "growth-of-income-and-trade"
                )
        `)
    }

    public async down(): Promise<void> {
        return
    }
}
