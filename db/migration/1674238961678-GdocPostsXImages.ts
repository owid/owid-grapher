import { MigrationInterface, QueryRunner } from "typeorm"

export class GdocPostsXImages1674238961678 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE posts_gdocs_x_images (
            id int NOT NULL AUTO_INCREMENT,
            gdocId varchar(255) NOT NULL,
            imageId int NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT FOREIGN KEY (gdocId) REFERENCES posts_gdocs (id),
            CONSTRAINT FOREIGN KEY (imageId) REFERENCES images (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS `posts_gdocs_x_images`")
    }
}
