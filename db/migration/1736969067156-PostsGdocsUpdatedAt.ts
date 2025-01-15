import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsUpdatedAt1736969067156 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            MODIFY COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            MODIFY COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            MODIFY COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            MODIFY COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        `)
    }
}
