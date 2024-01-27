import { MigrationInterface, QueryRunner } from "typeorm"

export class DropObsoleteTables1704297774028 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // drop tables country_name_tool_continent, country_name_tool_countrydata, country_name_tool_countryname
        await queryRunner.query(
            `DROP TABLE IF EXISTS country_name_tool_countryname`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS country_name_tool_countrydata`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS country_name_tool_continent`
        )
        // drop importer_importhistory
        await queryRunner.query(`DROP TABLE IF EXISTS importer_importhistory`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
