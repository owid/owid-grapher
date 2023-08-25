import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveDataValuesTable1691679300676 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE data_values;
            `
        )
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // no going back
        return
    }
}
