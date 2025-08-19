import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplorerViewsTable1755616979626 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the explorer_views table with all final columns and constraints
        await queryRunner.query(`-- sql
            CREATE TABLE explorer_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                explorerSlug varchar(255) NOT NULL,
                dimensions json NOT NULL,
                chartConfigId char(36) NULL,
                error TEXT NULL,
                CONSTRAINT fk_explorer_views_chart_config_id 
                    FOREIGN KEY (chartConfigId) REFERENCES chart_configs(id) 
                    ON DELETE CASCADE,
                CONSTRAINT fk_explorer_views_explorer_slug
                    FOREIGN KEY (explorerSlug) REFERENCES explorers(slug)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the explorer_views table and all its constraints
        await queryRunner.query(`-- sql
            DROP TABLE explorer_views
        `)
    }
}
