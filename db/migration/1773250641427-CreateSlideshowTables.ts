import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateSlideshowTables1773250641427 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE slideshows (
                id int NOT NULL AUTO_INCREMENT,
                slug varchar(255) NOT NULL,
                title varchar(255) NOT NULL,
                config json NOT NULL,
                userId int NOT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                isPublished tinyint(1) NOT NULL DEFAULT 0,
                publishedAt datetime DEFAULT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY slug (slug),
                KEY userId (userId),
                CONSTRAINT slideshows_ibfk_1 FOREIGN KEY (userId) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)

        await queryRunner.query(`
            CREATE TABLE slideshow_links (
                id int NOT NULL AUTO_INCREMENT,
                slideshowId int NOT NULL,
                target text NOT NULL,
                linkType enum('gdoc','url','grapher','explorer','narrative-chart','static-viz','dod','guided-chart') NOT NULL,
                queryString varchar(2047) NOT NULL DEFAULT '',
                hash varchar(2047) NOT NULL DEFAULT '',
                PRIMARY KEY (id),
                KEY slideshowId (slideshowId),
                KEY idx_slideshow_links_target (target(100), slideshowId),
                CONSTRAINT slideshow_links_ibfk_1 FOREIGN KEY (slideshowId) REFERENCES slideshows (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)

        await queryRunner.query(`
            CREATE TABLE slideshow_x_images (
                id int NOT NULL AUTO_INCREMENT,
                slideshowId int NOT NULL,
                imageId int NOT NULL,
                PRIMARY KEY (id),
                KEY slideshowId (slideshowId),
                KEY imageId (imageId),
                CONSTRAINT slideshow_x_images_ibfk_1 FOREIGN KEY (slideshowId) REFERENCES slideshows (id) ON DELETE CASCADE,
                CONSTRAINT slideshow_x_images_ibfk_2 FOREIGN KEY (imageId) REFERENCES images (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS slideshow_x_images`)
        await queryRunner.query(`DROP TABLE IF EXISTS slideshow_links`)
        await queryRunner.query(`DROP TABLE IF EXISTS slideshows`)
    }
}
