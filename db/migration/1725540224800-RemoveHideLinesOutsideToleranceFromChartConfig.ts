import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveHideLinesOutsideToleranceFromChartConfig1725540224800
    implements MigrationInterface
{
    private remove_hide_lines_outside_tolerance(field: string) {
        return `${field} = JSON_REMOVE(
          ${field},
          '$."hideLinesOutsideTolerance"'
        )`
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE
                chart_configs
            SET
                ${this.remove_hide_lines_outside_tolerance('full')},
                ${this.remove_hide_lines_outside_tolerance('patch')}
        `)
    }

    public async down(): Promise<void> {
        return
    }
}
