import { MigrationInterface, QueryRunner } from "typeorm"
import { uuidv7 } from "uuidv7"

export class MigrateExplorerViewsToUseChartConfigs1753194645809
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Create a temporary table to store the migration data
        await queryRunner.query(`-- sql
            CREATE TEMPORARY TABLE temp_explorer_view_configs AS
            SELECT 
                id,
                explorerSlug,
                dimensions,
                grapherConfig
            FROM explorer_views
        `)

        // Step 2: Add the new chartConfigId column
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            ADD COLUMN chartConfigId char(36) NULL
        `)

        // Step 3: For each row, insert the grapherConfig into chart_configs and get the ID
        const existingViews = await queryRunner.query(`-- sql
            SELECT id, grapherConfig FROM temp_explorer_view_configs
        `)

        for (const view of existingViews) {
            // Generate a unique ID for the chart config using uuidv7
            const chartConfigId = uuidv7()

            // Parse the JSON to ensure it's valid (we don't use it but validate it)
            JSON.parse(view.grapherConfig)

            // Insert into chart_configs table (only id, patch, full - other fields are auto-generated)
            await queryRunner.query(
                `-- sql
                INSERT INTO chart_configs (id, patch, \`full\`)
                VALUES (?, ?, ?)
            `,
                [
                    chartConfigId,
                    view.grapherConfig, // store full config in patch for conceptual clarity
                    view.grapherConfig, // use the original config as full config
                ]
            )

            // Update the explorer_views row with the chart config ID
            await queryRunner.query(
                `-- sql
                UPDATE explorer_views 
                SET chartConfigId = ?
                WHERE id = ?
            `,
                [chartConfigId, view.id]
            )
        }

        // Step 4: Make chartConfigId non-null and add foreign key constraint
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            MODIFY COLUMN chartConfigId char(36) NOT NULL
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            ADD CONSTRAINT fk_explorer_views_chart_config_id 
            FOREIGN KEY (chartConfigId) REFERENCES chart_configs(id) 
            ON DELETE CASCADE
        `)

        // Step 5: Drop the old grapherConfig column
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            DROP COLUMN grapherConfig
        `)

        // Step 6: Drop the temporary table
        await queryRunner.query(`-- sql
            DROP TEMPORARY TABLE temp_explorer_view_configs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Add back the grapherConfig column (initially nullable)
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            ADD COLUMN grapherConfig json NULL
        `)

        // Step 2: Populate the grapherConfig column from chart_configs
        await queryRunner.query(`-- sql
            UPDATE explorer_views ev
            JOIN chart_configs cc ON ev.chartConfigId = cc.id
            SET ev.grapherConfig = cc.\`full\`
        `)

        // Step 3: Make grapherConfig NOT NULL now that it's populated
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            MODIFY COLUMN grapherConfig json NOT NULL
        `)

        // Step 4: Clean up chart_configs entries that were created for explorer views
        // Do this before dropping the chartConfigId column
        await queryRunner.query(`-- sql
            DELETE cc FROM chart_configs cc
            JOIN explorer_views ev ON ev.chartConfigId = cc.id
        `)

        // Step 5: Drop foreign key constraint and chartConfigId column
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            DROP FOREIGN KEY fk_explorer_views_chart_config_id
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views 
            DROP COLUMN chartConfigId
        `)
    }
}
