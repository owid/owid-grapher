import { MigrationInterface, QueryRunner } from "typeorm"

export class DeleteObsoleteTables1675942735841 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`DROP TABLE settings;`)
        queryRunner.query(`DROP TABLE knex_migrations;`)
        queryRunner.query(`DROP TABLE knex_migrations_lock;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
