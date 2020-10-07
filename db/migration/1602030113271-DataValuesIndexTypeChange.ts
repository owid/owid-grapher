import { MigrationInterface, QueryRunner } from "typeorm"

export class DataValuesIndexTypeChange1602030113271
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query("ALTER TABLE `data_values` MODIFY `id` BIGINT")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query("ALTER TABLE `data_values` MODIFY `id` INT")
    }
}
