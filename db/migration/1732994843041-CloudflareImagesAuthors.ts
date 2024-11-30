import { MigrationInterface, QueryRunner } from "typeorm"

export class CloudflareImagesAuthors1732994843041
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE users_x_images (
                userId INTEGER REFERENCES users(id),
                imageId INTEGER REFERENCES images(id),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (userId, imageId)
            );
        `)
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE users_x_images;
        `)
    }
}
