import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveHideLinesOutsideToleranceFromConfig1722419367805
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_REMOVE(config, '$."hideLinesOutsideTolerance"')
            WHERE
                type = "ScatterPlot"
        `)
    }

    public async down(): Promise<void> {
        return
    }
}
