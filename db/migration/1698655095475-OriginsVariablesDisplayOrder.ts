import { MigrationInterface, QueryRunner } from "typeorm"

export class OriginsVariablesDisplayOrder1698655095475
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE origins_variables
            ADD COLUMN displayOrder SMALLINT NOT NULL DEFAULT 0;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE origins_variables
            DROP COLUMN displayOrder;`
        )
    }
}
