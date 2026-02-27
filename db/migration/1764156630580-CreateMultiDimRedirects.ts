import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateMultiDimRedirects1764156630580 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE multi_dim_redirects (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                source VARCHAR(512) NOT NULL UNIQUE,
                multiDimId INT UNSIGNED NOT NULL,
                viewConfigId CHAR(36) NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_multi_dim_redirects_multi_dim_id FOREIGN KEY (multiDimId) REFERENCES multi_dim_data_pages(id),
                CONSTRAINT fk_multi_dim_redirects_view_config_id FOREIGN KEY (viewConfigId) REFERENCES chart_configs(id)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE multi_dim_redirects
        `)
    }
}
