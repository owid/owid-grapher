import { MigrationInterface, QueryRunner } from "typeorm"

export class links1676376942081 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
        CREATE TABLE links (
            id INT NOT NULL AUTO_INCREMENT,
            source VARCHAR(255),
            target VARCHAR(2047) NOT NULL,
            type ENUM("gdoc", "url") NOT NULL,
            context VARCHAR(255) NOT NULL,
            PRIMARY KEY(id),
            CONSTRAINT FOREIGN KEY (source) REFERENCES posts_gdocs (id)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`DROP TABLE IF EXISTS links;`)
    }
}
