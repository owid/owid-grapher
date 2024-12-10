import { MigrationInterface, QueryRunner } from "typeorm"

export class CloudflareImagesAddUserId1732994843041
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images
            ADD COLUMN userId INTEGER,
            ADD CONSTRAINT fk_user_images
            FOREIGN KEY (userId) REFERENCES users(id)
            ON DELETE SET NULL;
        `)
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images DROP CONSTRAINT fk_user_images;
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE images DROP COLUMN userId;
        `)
    }
}
