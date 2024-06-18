import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRedirectsTtl1718295383278 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE redirects
            ADD COLUMN ttl TIMESTAMP DEFAULT NULL
        `)
        await queryRunner.query(
            "CREATE INDEX idx_redirects_ttl ON redirects (ttl)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP INDEX idx_redirects_ttl ON redirects")
        await queryRunner.query("ALTER TABLE redirects DROP COLUMN ttl")
    }
}
