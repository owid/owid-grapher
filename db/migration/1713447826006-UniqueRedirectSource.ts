import { MigrationInterface, QueryRunner } from "typeorm"

export class UniqueRedirectSource1713447826006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE redirects ADD CONSTRAINT source_unique UNIQUE (source(255))`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE redirects DROP CONSTRAINT source_unique`
        )
    }
}
