import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartConfigsTable1719842654592 implements MigrationInterface {
    private async createChartConfigsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE chart_configs (
                id binary(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(), 1)) PRIMARY KEY,
                uuid varchar(36) GENERATED ALWAYS AS (BIN_TO_UUID(id, 1)) VIRTUAL,
                patchConfig json NOT NULL,
                config json NOT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE INDEX idx_chart_configs_uuid (uuid)
            )
        `)
    }

    private async createConfigIdColumnInChartsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        // add a new `configId` column to the charts table
        // that points to the `chart_configs` table
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            ADD COLUMN configId binary(16) UNIQUE AFTER type,
            ADD CONSTRAINT charts_configId
                FOREIGN KEY (configId)
                REFERENCES chart_configs (id)
                ON DELETE RESTRICT
                ON UPDATE RESTRICT
        `)
    }

    private async moveConfigsToChartConfigsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        // make sure that the config's id matches the table's primary key
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_REPLACE(config, '$.id', id)
            WHERE id != config ->> "$.id";
        `)

        // insert all the configs into the `chart_configs` table
        const configs = await queryRunner.query("SELECT config from charts")
        for (const { config } of configs) {
            await queryRunner.query(
                "INSERT INTO chart_configs (patchConfig, config) VALUES (?, ?)",
                [config, config]
            )
        }

        // update the `configId` column in the `charts` table
        await queryRunner.query(`-- sql
            UPDATE charts ca
            JOIN chart_configs cc
            ON ca.id = JSON_UNQUOTE(JSON_EXTRACT(cc.config, '$.id'))
            SET ca.configId = cc.id
        `)

        // now that the `configId` column is filled, make it NOT NULL
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            MODIFY COLUMN configId binary(16) NOT NULL;
        `)

        // update `createdAt` and `updatedAt` of the chart_configs table
        await queryRunner.query(`-- sql
            UPDATE chart_configs cc
            JOIN charts ca
            ON cc.id = ca.configId
            SET
                cc.createdAt = ca.createdAt,
                cc.updatedAt = ca.updatedAt
        `)
    }

    private async dropVirtualColumnsFromChartsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            DROP COLUMN slug,
            DROP COLUMN type
        `)
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.createChartConfigsTable(queryRunner)
        await this.createConfigIdColumnInChartsTable(queryRunner)
        await this.moveConfigsToChartConfigsTable(queryRunner)
        await this.dropVirtualColumnsFromChartsTable(queryRunner)

        // note that we don't drop the `charts.config`;
        // we keep it around for a while in case we need to rollback
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // add back virtual columns to the `charts` table
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            ADD COLUMN slug VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(config, '$.slug'))) VIRTUAL AFTER id,
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(config, '$.type')), 'LineChart')) VIRTUAL AFTER slug
        `)

        // drop the `charts.configId` column
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            DROP FOREIGN KEY charts_configId,
            DROP COLUMN configId
        `)

        // drop the `chart_configs` table
        await queryRunner.query(`-- sql
            DROP TABLE chart_configs
        `)
    }
}
