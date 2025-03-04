import { MigrationInterface, QueryRunner } from "typeorm"

export class CreatedAtNotNull1740690097502 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs MODIFY createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs MODIFY createdAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP;`
        )
    }
}
