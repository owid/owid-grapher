import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveSessionsTable1768915812013 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS sessions;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE sessions (
                session_key varchar(40) NOT NULL,
                session_data longtext NOT NULL,
                expire_date datetime NOT NULL,
                PRIMARY KEY (session_key),
                KEY django_session_expire_date_a5c62663 (expire_date)
            );
        `)
    }
}
