import { MigrationInterface, QueryRunner } from "typeorm"

export class DataValuesYearIndex1551319875625 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE INDEX data_values_year ON data_values (year);"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
