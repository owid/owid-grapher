import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateFilesTable1752609274049 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE files (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(256) NOT NULL,
                path VARCHAR(96) NOT NULL,
                etag VARCHAR(64) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                createdBy INT NULL,
                UNIQUE KEY (filename, path),
                FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS files
        `)
    }
}
