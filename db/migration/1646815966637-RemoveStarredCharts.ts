import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveStarredCharts1646815966637 implements MigrationInterface {
    name = "RemoveStarredCharts1646815966637"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE charts DROP COLUMN starred;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE charts ADD starred TINYINT NOT NULL;`
        )
    }
}
