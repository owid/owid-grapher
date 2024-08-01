import { MigrationInterface, QueryRunner } from "typeorm"

export class ChartDimensionsOnDeleteCascade1722419367802
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE chart_dimensions
            DROP FOREIGN KEY chart_dimensions_chartId_78d6a092_fk_charts_id
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE chart_dimensions
            ADD CONSTRAINT chart_dimensions_chartId_78d6a092_fk_charts_id
                FOREIGN KEY (chartId) REFERENCES charts(id)
                ON DELETE CASCADE ON UPDATE RESTRICT;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE chart_dimensions
            DROP FOREIGN KEY chart_dimensions_chartId_78d6a092_fk_charts_id
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE chart_dimensions
            ADD CONSTRAINT chart_dimensions_chartId_78d6a092_fk_charts_id
                FOREIGN KEY (chartId) REFERENCES charts(id)
                ON DELETE RESTRICT ON UPDATE RESTRICT;
        `)
    }
}
