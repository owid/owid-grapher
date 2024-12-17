import { MigrationInterface, QueryRunner } from "typeorm"

export class CloudflareImagesReplacedBy1734369183234
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP KEY filename
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE images 
            ADD COLUMN replacedBy INT NULL,
            ADD COLUMN version INT NOT NULL DEFAULT 0,
            ADD CONSTRAINT fk_images_replaced_by 
                FOREIGN KEY (replacedBy) 
                REFERENCES images(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE,
            ADD CONSTRAINT uk_images_filename_version
                UNIQUE (filename, version)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP FOREIGN KEY fk_images_replaced_by
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP COLUMN replacedBy,
            DROP COLUMN version
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE images
            ADD UNIQUE KEY filename (filename)
        `)
    }
}
