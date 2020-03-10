import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplorableCharts1574953821471 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(
            "ALTER TABLE charts ADD COLUMN isExplorable BOOLEAN NOT NULL DEFAULT FALSE"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query("ALTER TABLE charts DROP COLUMN isExplorable")
    }
}
