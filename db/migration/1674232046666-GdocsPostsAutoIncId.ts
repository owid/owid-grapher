import { MigrationInterface, QueryRunner } from "typeorm"

export class GdocsPostsAutoIncId1674232046666 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts_gdocs DROP PRIMARY KEY`)
        await queryRunner.query(
            `ALTER TABLE posts_gdocs CHANGE id googleId VARCHAR(255)`
        )
        await queryRunner.query(
            `ALTER TABLE posts_gdocs MODIFY googleId VARCHAR(255) UNIQUE`
        )
        await queryRunner.query(
            `ALTER TABLE posts_gdocs ADD id INT AUTO_INCREMENT NOT NULL PRIMARY KEY FIRST`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts_gdocs DROP id`)
        await queryRunner.query(
            `ALTER TABLE posts_gdocs MODIFY googleId VARCHAR(255)`
        )
        await queryRunner.query(
            `ALTER TABLE posts_gdocs CHANGE googleId id VARCHAR(255)`
        )
        await queryRunner.query(`ALTER TABLE posts_gdocs ADD PRIMARY KEY (id)`)
    }
}
