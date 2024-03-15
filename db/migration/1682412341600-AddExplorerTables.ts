import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplorerTables1682412341600 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS explorers (
                slug VARCHAR(150) PRIMARY KEY,
                isPublished BOOLEAN NOT NULL,
                config JSON NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `)

        await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS explorer_charts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                explorerSlug VARCHAR(150) NOT NULL,
                chartId INT NOT NULL,
                FOREIGN KEY (explorerSlug) REFERENCES explorers(slug) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (chartId) REFERENCES charts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE IF EXISTS explorer_charts;
        `)
        await queryRunner.query(`
            DROP TABLE IF EXISTS explorers;
        `)
    }
}
