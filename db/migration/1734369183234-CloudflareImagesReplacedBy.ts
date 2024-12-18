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
            -- Necessary to create a unique constraint with filename, so that we can have multiple versions of the same image,
            -- but not multiple images with the same filename and version.
            -- i.e.
            -- You can upload test.png and *replace* it with test.png, but you can't upload a *new* image named test.png,
            -- because that would have a version of 0 and conflict with the first test.png that was uploaded
            -- This was done because MySQL 8 doesn't support partial unique indexes (e.g. "UNIQUE(filename) WHERE replacedBy IS NULL")
            -- Nor a unique constraint when the column is nullable (e.g. "UNIQUE(filename, replacedBy)" would allow multiple rows with ["test.png", null])
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
