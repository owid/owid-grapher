import { MigrationInterface, QueryRunner } from "typeorm"

export class VariableViews1662646791543 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              ADD COLUMN catalogPath TEXT,
              ADD dimensions JSON;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              DROP COLUMN catalogPath,
              DROP COLUMN dimensions;
            `
        )
    }
}
