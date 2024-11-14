import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChartViewsTable1731589634295 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE chart_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(255) NOT NULL,
                chartConfigId CHAR(36) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chartConfigId) REFERENCES chart_configs(id)
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE chart_views;
        `)
    }
}
