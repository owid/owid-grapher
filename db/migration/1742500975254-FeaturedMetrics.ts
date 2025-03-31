import { MigrationInterface, QueryRunner } from "typeorm"

export class FeaturedMetrics1742500975254 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE featured_metrics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(512) NOT NULL,
                parentTagId INT NOT NULL,
                -- rank is a keyword in MySQL, hence "ranking" 
                ranking INT NOT NULL,
                incomeGroup ENUM('low', 'lower-middle', 'upper-middle', 'high', 'all') DEFAULT 'all',
                FOREIGN KEY (parentTagId) REFERENCES tags(id) ON DELETE CASCADE,
                CONSTRAINT unique_featured_metrics UNIQUE (url, parentTagId, incomeGroup)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE featured_metrics
        `)
    }
}
