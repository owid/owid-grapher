import { MigrationInterface, QueryRunner } from "typeorm"

export class AddTypeAndSortToVariables1710255240486
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
                ADD COLUMN type ENUM('float', 'int', 'mixed', 'string', 'ordinal') NULL,
                ADD COLUMN sort JSON NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables DROP COLUMN type, DROP COLUMN sort`
        )
    }
}
