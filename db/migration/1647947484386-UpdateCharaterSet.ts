import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateCharaterSet1647947484386 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const dbname = await queryRunner.getCurrentDatabase()
        // Note that as a first step we change the variables name column from 1000 chars long to 750 so that
        // once we use the potentially 4 byte UTF8mb4 encoding the unique index will still stay below the 3072 byte limit
        const queries = `SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE \`variables\` modify column name VARCHAR(750);
ALTER DATABASE ${dbname} CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_as_cs;
ALTER TABLE \`chart_dimensions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`chart_slug_redirects\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`country_latest_data\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`country_name_tool_continent\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`country_name_tool_countrydata\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`country_name_tool_countryname\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`datasets\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`entities\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`importer_additionalcountryinfo\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`importer_importhistory\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`knex_migrations\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`migrations\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`namespaces\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`posts\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`settings\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`sources\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`suggested_chart_revisions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`users\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`variables\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`sessions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`user_invitations\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`dataset_files\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`data_values\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`chart_revisions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`chart_tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`charts\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`dataset_tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`knex_migrations_lock\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`post_tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
SET FOREIGN_KEY_CHECKS = 1;
        `.split(";")
        for (const query of queries) {
            if (query.trim() !== "") await queryRunner.query(query)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
