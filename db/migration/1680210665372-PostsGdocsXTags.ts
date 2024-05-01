import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsXTags1680210665372 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE posts_gdocs_x_tags (
            gdocId VARCHAR(255) NOT NULL,
            tagId INT NOT NULL,
            PRIMARY KEY (gdocId,tagId),
            CONSTRAINT FK_posts_gdocs_x_tags_gdoc_id FOREIGN KEY (gdocId) REFERENCES posts_gdocs (id) ON DELETE CASCADE ON UPDATE RESTRICT,
            CONSTRAINT FK_posts_gdocs_x_tags_tag_id FOREIGN KEY (tagId) REFERENCES tags (id) ON DELETE CASCADE ON UPDATE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE IF EXISTS posts_gdocs_x_tags;
        `)
    }
}
