import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsLinks1692042923850 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE posts_links (
                id int NOT NULL AUTO_INCREMENT,
                sourceId int NOT NULL,
                target varchar(2047) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                linkType enum('url','grapher','explorer', 'gdoc') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
                componentType varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                text varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                queryString varchar(2047) COLLATE utf8mb4_0900_as_cs NOT NULL,
                hash varchar(2047) COLLATE utf8mb4_0900_as_cs NOT NULL,
                PRIMARY KEY (id),
                KEY sourceId (sourceId),
                CONSTRAINT posts_links_ibfk_1 FOREIGN KEY (sourceId) REFERENCES posts (id)
                ) ENGINE=InnoDB;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS posts_links;
        `)
    }
}
