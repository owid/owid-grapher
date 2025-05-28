import { MigrationInterface, QueryRunner } from "typeorm"

export class DropSuggestedChartRevisionsTable1748446282000
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DROP TABLE IF EXISTS `suggested_chart_revisions`"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No rollback - table removal is permanent
    }
}
