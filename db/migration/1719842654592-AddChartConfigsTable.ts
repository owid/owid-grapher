import { MigrationInterface, QueryRunner } from "typeorm"
import { uuidv7 } from "uuidv7"
export class AddChartConfigsTable1719842654592 implements MigrationInterface {
    private async createChartConfigsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE chart_configs (
                id char(36) NOT NULL PRIMARY KEY,
                patch json NOT NULL,
                full json NOT NULL,
                slug varchar(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(full, '$.slug'))) STORED,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_chart_configs_slug (slug)
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
            ADD COLUMN configId char(36) UNIQUE AFTER type,
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

        const chartConfigs: { config: string }[] =
            await queryRunner.query(`-- sql
            select config from charts`)

        // I tried to write this as a chunked builk insert of 500 at a time but
        // failed to get it to work without doing strange things. We only run this once
        // for ~5000 items so it's not too bad to do it one insert at a time
        for (const chartConfig of chartConfigs) {
            await queryRunner.query(
                `-- sql
                INSERT INTO chart_configs (id, patch, full)
                VALUES (?, ?, ?)`,
                [uuidv7(), chartConfig.config, chartConfig.config]
            )
        }

        // update the `configId` column in the `charts` table
        await queryRunner.query(`-- sql
            UPDATE charts ca
            JOIN chart_configs cc
            ON ca.id = cc.full ->> '$.id'
            SET ca.configId = cc.id
        `)

        // now that the `configId` column is filled, make it NOT NULL
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            MODIFY COLUMN configId char(36) NOT NULL;
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

    private async dropConfigColumnFromChartsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            DROP COLUMN slug,
            DROP COLUMN type,
            DROP COLUMN config
        `)
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.createChartConfigsTable(queryRunner)
        await this.createConfigIdColumnInChartsTable(queryRunner)
        await this.moveConfigsToChartConfigsTable(queryRunner)
        await this.dropConfigColumnFromChartsTable(queryRunner)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // add back the config column and its virtual columns
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            ADD COLUMN config JSON AFTER configId,
            ADD COLUMN slug VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(config, '$.slug'))) VIRTUAL AFTER config,
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(config, '$.type')), 'LineChart')) VIRTUAL AFTER slug
        `)

        await queryRunner.query(`-- sql
            CREATE INDEX idx_charts_slug ON charts (slug)
        `)

        // recover configs
        await queryRunner.query(`-- sql
            UPDATE charts c
            JOIN chart_configs cc ON c.configId = cc.id
            SET c.config = cc.full
        `)

        // make the config column NOT NULL
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            MODIFY COLUMN config JSON NOT NULL;
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
