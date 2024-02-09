import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRedirectsTable1707467006420 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE redirects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                code INT DEFAULT 301,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE redirects`)
    }
}
