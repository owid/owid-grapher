import { MigrationInterface, QueryRunner } from "typeorm"

export class CloudflareImages1731360326761 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images ADD COLUMN cloudflareId VARCHAR(255) NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images DROP COLUMN cloudflareId
        `)
    }
}
