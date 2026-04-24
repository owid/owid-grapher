import { MigrationInterface, QueryRunner } from "typeorm"

export class DropCountryLatestData1772795700698 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS country_latest_data`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE country_latest_data (
                country_code varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
                variable_id int DEFAULT NULL,
                year int DEFAULT NULL,
                value varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
                UNIQUE KEY country_latest_data_country_code_variable_id_unique (country_code, variable_id),
                KEY country_latest_data_variable_id_foreign (variable_id),
                CONSTRAINT country_latest_data_variable_id_foreign FOREIGN KEY (variable_id) REFERENCES variables (id) ON DELETE RESTRICT ON UPDATE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }
}
