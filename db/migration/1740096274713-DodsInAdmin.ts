import { MigrationInterface, QueryRunner } from "typeorm"

export class DodsInAdmin1740096274713 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE dods (
                id SERIAL PRIMARY KEY,
                name VARCHAR(512) NOT NULL UNIQUE,
                content TEXT NOT NULL,
                createdAt TIMESTAMP NOT NULL DEFAULT now(),
                updatedAt TIMESTAMP NOT NULL DEFAULT now(),
                lastUpdatedUserId INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
            );
        `)
        await queryRunner.query(`-- sql
            CREATE TABLE dod_links (
                id SERIAL PRIMARY KEY,
                dodId INTEGER NOT NULL REFERENCES dods(id) ON DELETE CASCADE,
                target TEXT NOT NULL,
                linkType ENUM('gdoc','url','grapher','explorer','chart-view'),
                text TEXT NOT NULL DEFAULT '',
                queryString TEXT NOT NULL DEFAULT '',
                hash TEXT NOT NULL DEFAULT ''
            );
        `)

        await queryRunner.query(`-- sql
            CREATE INDEX idx_dod_links_dod_id ON dod_links(dodId);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE dod_links;
        `)
        await queryRunner.query(`-- sql
            DROP TABLE dods;
        `)
    }
}
