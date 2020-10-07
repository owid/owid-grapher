import { MigrationInterface, QueryRunner } from "typeorm"

export class DropDataValuesId1602074206107 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(
            "ALTER TABLE data_values DROP PRIMARY KEY, DROP COLUMN id, ADD PRIMARY KEY (variableId, entityId, year);"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // one way we go! confidence levels high!
    }
}
