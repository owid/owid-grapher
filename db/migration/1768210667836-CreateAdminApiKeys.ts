import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAdminApiKeys1768210667836 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE admin_api_keys (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                keyHash CHAR(64) NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                lastUsedAt DATETIME NULL,
                UNIQUE KEY (keyHash),
                CONSTRAINT fk_admin_api_keys_user_id FOREIGN KEY (userId) REFERENCES users(id)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS admin_api_keys
        `)
    }
}
