import { MigrationInterface, QueryRunner } from "typeorm"

export class DatasetsFieldNameMandatory1706317870929
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // The name field is nullable in the DB schema but null is never used in the values in the DB,
        // so it's better to make it mandatory in the DB schema.
        await queryRunner.query(
            `ALTER TABLE datasets MODIFY COLUMN name VARCHAR(512) NOT NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE datasets MODIFY COLUMN name VARCHAR(512)`
        )
    }
}
