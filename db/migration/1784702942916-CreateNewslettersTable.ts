import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateNewslettersTable1784702942916 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE newsletters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mailchimpId VARCHAR(64) NOT NULL UNIQUE,
                type VARCHAR(32) NOT NULL,
                title VARCHAR(512) NOT NULL,
                url VARCHAR(1024) NOT NULL,
                publishedAt DATETIME NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_newsletters_type_publishedAt (type, publishedAt)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE newsletters`)
    }
}
