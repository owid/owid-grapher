import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRelatedChartsTable1736933781669 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE related_charts (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                chartId INT NOT NULL,
                relatedChartId INT NOT NULL,
                label VARCHAR(255) NOT NULL,
                reviewer VARCHAR(255) DEFAULT NULL,
                reason TEXT DEFAULT NULL,
                score DOUBLE DEFAULT NULL,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT related_charts_ibfk_1
                    FOREIGN KEY (chartId) REFERENCES charts (id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE,
                CONSTRAINT related_charts_ibfk_2
                    FOREIGN KEY (relatedChartId) REFERENCES charts (id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE,
                KEY idx_related_charts_chartId (chartId),
                UNIQUE KEY uq_chartId_relatedChartId_reviewer (chartId, relatedChartId, reviewer)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE related_charts`)
    }
}
