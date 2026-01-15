import { MigrationInterface, QueryRunner } from "typeorm"

export class DropUsersPassword1768474334685 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE users
            DROP COLUMN password
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE users
            ADD COLUMN password VARCHAR(128) NULL
        `)
    }
}
