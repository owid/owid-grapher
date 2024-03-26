import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsLinks1676376942081 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE posts_gdocs_links (
            id INT NOT NULL AUTO_INCREMENT,
            sourceId VARCHAR(255) COLLATE utf8mb4_0900_as_cs,
            target VARCHAR(2047) NOT NULL,
            linkType ENUM("gdoc", "url") NOT NULL,
            componentType VARCHAR(255) NOT NULL,
            text VARCHAR(255) NOT NULL,
            PRIMARY KEY(id),
            CONSTRAINT FOREIGN KEY (sourceId) REFERENCES posts_gdocs (id)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS posts_gdocs_links;`)
    }
}
