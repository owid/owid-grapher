import { MigrationInterface, QueryRunner } from "typeorm"

export class SuggestedRevisionsFkRelaxing1722418726999
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change: ON DELETE RESTRICT -> ON DELETE CASCADE
        //
        // This means that if a chart or user is deleted, then any
        // linked suggested revisions are deleted too.
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            DROP FOREIGN KEY suggested_chart_revisions_ibfk_1
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            ADD CONSTRAINT suggested_chart_revisions_ibfk_1
                FOREIGN KEY (chartId) REFERENCES charts(id)
                ON DELETE CASCADE ON UPDATE RESTRICT;
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            DROP FOREIGN KEY suggested_chart_revisions_ibfk_2
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            ADD CONSTRAINT suggested_chart_revisions_ibfk_2
                FOREIGN KEY (createdBy) REFERENCES users(id)
                ON DELETE CASCADE ON UPDATE RESTRICT;
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            DROP FOREIGN KEY suggested_chart_revisions_ibfk_3
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            ADD CONSTRAINT suggested_chart_revisions_ibfk_3
                FOREIGN KEY (updatedBy)
                REFERENCES users(id)
                ON DELETE CASCADE ON UPDATE RESTRICT;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            DROP FOREIGN KEY suggested_chart_revisions_ibfk_1
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            ADD CONSTRAINT suggested_chart_revisions_ibfk_1
                FOREIGN KEY (chartId) REFERENCES charts(id)
                ON DELETE RESTRICT ON UPDATE RESTRICT;
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            DROP FOREIGN KEY suggested_chart_revisions_ibfk_2
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            ADD CONSTRAINT suggested_chart_revisions_ibfk_2
                FOREIGN KEY (createdBy) REFERENCES users(id)
                ON DELETE RESTRICT ON UPDATE RESTRICT;
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            DROP FOREIGN KEY suggested_chart_revisions_ibfk_3
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE suggested_chart_revisions
            ADD CONSTRAINT suggested_chart_revisions_ibfk_3
                FOREIGN KEY (updatedBy)
                REFERENCES users(id)
                ON DELETE RESTRICT ON UPDATE RESTRICT;
        `)
    }
}
