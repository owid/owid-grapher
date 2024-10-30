import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateMultiDimXChartConfigs1729684787090
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE multi_dim_x_chart_configs (
                id SERIAL PRIMARY KEY,
                multiDimId BIGINT UNSIGNED NOT NULL,
                viewId VARCHAR(255) NOT NULL,
                variableId INT NOT NULL,
                chartConfigId CHAR(36) NOT NULL UNIQUE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY (multiDimId, viewId),
                CONSTRAINT fk_multi_dim_x_chart_configs_multi_dim_id FOREIGN KEY (multiDimId) REFERENCES multi_dim_data_pages(id),
                CONSTRAINT fk_multi_dim_x_chart_configs_variable_id FOREIGN KEY (variableId) REFERENCES variables(id),
                CONSTRAINT fk_multi_dim_x_chart_configs_chart_config_id FOREIGN KEY (chartConfigId) REFERENCES chart_configs(id)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE multi_dim_x_chart_configs
        `)
    }
}
