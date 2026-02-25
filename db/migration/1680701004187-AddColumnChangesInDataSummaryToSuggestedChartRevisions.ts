import { MigrationInterface, QueryRunner } from "typeorm"

export class AddColumnChangesInDataSummaryToSuggestedChartRevisions1680701004187 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE suggested_chart_revisions
              ADD COLUMN changesInDataSummary TEXT;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE suggested_chart_revisions
              DROP COLUMN changesInDataSummary;
            `
        )
    }
}
