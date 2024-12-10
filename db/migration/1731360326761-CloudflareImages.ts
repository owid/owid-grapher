import { MigrationInterface, QueryRunner } from "typeorm"

export class CloudflareImages1731360326761 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images
            ADD COLUMN cloudflareId CHAR(36) NULL,
            ADD CONSTRAINT images_cloudflareId_unique UNIQUE (cloudflareId),
            ADD COLUMN hash VARCHAR(255) NULL,
            MODIFY COLUMN googleId VARCHAR(255) NULL,
            MODIFY COLUMN defaultAlt VARCHAR(1600) NULL;`)

        // One-way migration 👋
        await queryRunner.query(`-- sql
            UPDATE images
            SET defaultAlt = NULL
            WHERE defaultAlt = 'legacy-wordpress-upload';
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP COLUMN cloudflareId,
            DROP COLUMN hash
        `)

        await queryRunner.query(`-- sql
            UPDATE images 
            SET googleId = 'cloudflare_image' 
            WHERE googleId IS NULL
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE images 
            MODIFY COLUMN googleId VARCHAR(255) NOT NULL
        `)
    }
}
