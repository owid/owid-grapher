import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPageviewsTable1676018297069 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE pageviews (
            day date NOT NULL,
            url varchar(255) NOT NULL,
            views_7d INT UNSIGNED NOT NULL,
            views_14d INT UNSIGNED NOT NULL,
            PRIMARY KEY (day, url)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE pageviews`)
    }
}
