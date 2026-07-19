import { MigrationInterface, QueryRunner } from "typeorm"

export class DropRedirectsCodeColumn1784447715270 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE redirects DROP COLUMN code`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE redirects ADD COLUMN code INT DEFAULT 301`
        )
    }
}
