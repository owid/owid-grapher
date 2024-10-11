import { MigrationInterface, QueryRunner } from "typeorm"

export class DefaultThumbnailJpgToPng1728311917849
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target) VALUES ('/default-thumbnail.jpg', '/default-thumbnail.png');
            `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE FROM redirects WHERE source = '/default-thumbnail.jpg' AND target = '/default-thumbnail.png';
            `)
    }
}
