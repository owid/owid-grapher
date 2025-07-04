import { MigrationInterface, QueryRunner } from "typeorm"

export class StaticVizTable1751646349658 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE IF NOT EXISTS static_viz (
                id int NOT NULL AUTO_INCREMENT,
                slug varchar(255) NOT NULL,
                title varchar(500) NOT NULL,
                description text,
                grapherSlug varchar(255) DEFAULT NULL,
                sourceUrl varchar(1000) DEFAULT NULL,
                imageId int NOT NULL,
                mobileImageId int DEFAULT NULL,
                createdBy int DEFAULT NULL,
                updatedBy int DEFAULT NULL,
                createdAt timestamp DEFAULT CURRENT_TIMESTAMP,
                updatedAt timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_static_viz_slug (slug),
                KEY fk_static_viz_image (imageId),
                KEY fk_static_viz_mobile_image (mobileImageId),
                KEY fk_static_viz_user_created_by (createdBy),
                KEY fk_static_viz_user_updated_by (updatedBy),
                CONSTRAINT fk_static_viz_image FOREIGN KEY (imageId) REFERENCES images (id),
                CONSTRAINT fk_static_viz_mobile_image FOREIGN KEY (mobileImageId) REFERENCES images (id),
                CONSTRAINT fk_static_viz_user_created_by FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE SET NULL,
                CONSTRAINT fk_static_viz_user_updated_by FOREIGN KEY (updatedBy) REFERENCES users (id) ON DELETE SET NULL,
                CONSTRAINT chk_static_viz_source CHECK ((grapherSlug IS NOT NULL) OR (sourceUrl IS NOT NULL))
            )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS static_viz;
        `)
    }
}
