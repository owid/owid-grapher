import { MigrationInterface, QueryRunner } from "typeorm"

export class IndexUpdatedAt1695651135934 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs ADD INDEX idx_updatedAt (updatedAt);`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs DROP INDEX idx_updatedAt (updatedAt);`
        )
    }
}
