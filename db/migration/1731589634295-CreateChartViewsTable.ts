import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChartViewsTable1731589634295 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE chart_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(255) NOT NULL,
                chartConfigId CHAR(36) NOT NULL,
                parentChartId INT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                lastEditedByUserId INT NOT NULL,
                FOREIGN KEY (chartConfigId) REFERENCES chart_configs(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
                FOREIGN KEY (parentChartId) REFERENCES charts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
                FOREIGN KEY (lastEditedByUserId) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE chart_views;
        `)
    }
}
