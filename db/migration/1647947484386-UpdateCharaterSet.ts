import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateCharaterSet1647947484386 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Note that as a first step we change the variables name column from 1000 chars long to 750 so that
        // once we use the potentially 4 byte UTF8mb4 encoding the unique index will still stay below the 3072 byte limit
        const queries = `SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE \`grapher\`.\`variables\` modify column name VARCHAR(750);
ALTER DATABASE grapher CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`chart_dimensions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`chart_slug_redirects\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`country_latest_data\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`country_name_tool_continent\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`country_name_tool_countrydata\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`country_name_tool_countryname\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`datasets\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`entities\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`importer_additionalcountryinfo\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`importer_importhistory\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`knex_migrations\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`migrations\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`namespaces\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`posts\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`settings\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`sources\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`suggested_chart_revisions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`users\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`variables\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`sessions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`user_invitations\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`dataset_files\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`data_values\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`chart_revisions\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`chart_tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`charts\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`dataset_tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`knex_migrations_lock\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
ALTER TABLE \`grapher\`.\`post_tags\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
SET FOREIGN_KEY_CHECKS = 1;
        `.split(";")
        for (const query of queries) {
            if (query.trim() !== "") await queryRunner.query(query)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
