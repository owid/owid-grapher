import { MigrationInterface, QueryRunner } from "typeorm"

const tablesWithTimestamps = [
    "users",
    "entities",
    "sources",
    "variables",
    "datasets",
    "charts",
    "tags",
    "chart_revisions",
    "suggested_chart_revisions",
]

const tablesWithoutTimestamps = [
    "namespaces",
    "chart_dimensions",
    "chart_slug_redirects",
    "chart_tags",
    "dataset_files",
    "dataset_tags",
    "post_tags",
    "details",
]

export class AutomatedCreatedUpdatedTimestamps1675107812815 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Modify the existing tables that have a createdAt and updatedAt column
        // to use the automatic CURRENT_TIMESTAMP and ON UPDATE CURRENT_TIMESTAMP
        // values
        for (const table of tablesWithTimestamps) {
            await queryRunner.query(`
                ALTER TABLE ${table}
                    MODIFY COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    MODIFY COLUMN updatedAt DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
            `)
        }
        // settings table is similar but has different column names
        await queryRunner.query(`
                ALTER TABLE settings
                    MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    MODIFY COLUMN updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
            `)
        // posts does not have a created_at column - I considered adding it but
        // it might communicate something wrong - that it is the creation date
        // of the wordpress post, not the creation date of the post entry in our
        // database
        await queryRunner.query(`
                ALTER TABLE posts
                    MODIFY COLUMN updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
            `)

        // Several tables are missing the createdAt and updatedAt columns
        for (const table of tablesWithoutTimestamps) {
            await queryRunner.query(`
                    ALTER TABLE ${table}
                        ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ADD COLUMN updatedAt DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
                `)
        }

        // Several tables are conciously ommitted from getting an automatic created/updated timestamp.
        // These tables are:
        // - knex_migrations
        // - knex_migrations_lock
        // - migrations
        // - sessions
        // - importer_additionalcountryinfo
        // - importer_importhistory
        // - country_latest_data
        // - country_name_tool_continent
        // - country_name_tool_countrydata
        // - country_name_tool_countryname
        // - data_values
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // We don't bother reversing the changes to the tables that already had
        // a createdAt and updatedAt column - we just remove the columns from
        // tables where createdAt or updatedAt are not present

        for (const table of tablesWithoutTimestamps) {
            await queryRunner.query(`
                ALTER TABLE ${table}
                    DROP COLUMN createdAt,
                    DROP COLUMN updatedAt;
                `)
        }
    }
}
