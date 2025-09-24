import { MigrationInterface, QueryRunner } from "typeorm"

export class ImagesSetNonNull1758638800569 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
                ALTER TABLE images
                    MODIFY COLUMN originalWidth INT NOT NULL,
                    MODIFY COLUMN originalHeight INT NOT NULL,
                    MODIFY COLUMN cloudflareId CHAR(36) NOT NULL,
                    MODIFY COLUMN hash VARCHAR(255) NOT NULL;
            `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
                ALTER TABLE images
                    MODIFY COLUMN originalWidth INT NULL,
                    MODIFY COLUMN originalHeight INT NULL,
                    MODIFY COLUMN cloudflareId CHAR(36) NULL,
                    MODIFY COLUMN hash VARCHAR(255) NULL;
            `)
    }
}
