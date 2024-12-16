import { MigrationInterface, QueryRunner } from "typeorm"

export class CloudflareImagesReplacedBy1734369183234
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the existing unique key on filename
        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP KEY filename
        `)

        // Add the replacedBy column
        await queryRunner.query(`-- sql
            ALTER TABLE images 
            ADD COLUMN replacedBy INT NULL,
            ADD CONSTRAINT fk_images_replaced_by 
                FOREIGN KEY (replacedBy) 
                REFERENCES images(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        `)

        // Add unique constraint on replacedBy and filename
        await queryRunner.query(`-- sql
            ALTER TABLE images
            ADD CONSTRAINT uk_images_replaced_by_filename 
            UNIQUE (replacedBy, filename)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the combined unique constraint
        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP KEY uk_images_replaced_by_filename
        `)

        // Remove the foreign key constraint and column
        await queryRunner.query(`-- sql
            ALTER TABLE images
            DROP FOREIGN KEY fk_images_replaced_by,
            DROP COLUMN replacedBy
        `)

        // Restore the original unique key on filename
        await queryRunner.query(`-- sql
            ALTER TABLE images
            ADD UNIQUE KEY filename (filename)
        `)
    }
}
