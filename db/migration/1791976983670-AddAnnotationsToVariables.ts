import { MigrationInterface, QueryRunner } from "typeorm"

export class AddAnnotationsToVariables1791976983670 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables ADD COLUMN annotations JSON NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE variables DROP COLUMN annotations`)
    }
}
