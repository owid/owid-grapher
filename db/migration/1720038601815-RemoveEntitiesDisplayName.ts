import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveEntitiesDisplayName1720038601815 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        "ALTER TABLE entites DROP COLUMN displayName"
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        "ALTER TABLE entites ADD COLUMN displayName"
    }
}
