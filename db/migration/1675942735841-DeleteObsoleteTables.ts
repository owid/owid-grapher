import { MigrationInterface, QueryRunner } from "typeorm"

export class DeleteObsoleteTables1675942735841 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE settings;`)
        await queryRunner.query(`DROP TABLE knex_migrations;`)
        await queryRunner.query(`DROP TABLE knex_migrations_lock;`)
    }

    public async down(): Promise<void> {} // eslint-disable-line
}
