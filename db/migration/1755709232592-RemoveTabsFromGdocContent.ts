import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveTabsFromGdocContent1755709232592
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE posts_gdocs
            SET content = REPLACE(content, '\\\\u000b', ' ')
            WHERE content LIKE '%\\\\u000b%'
        `)
    }

    public async down(_: QueryRunner): Promise<void> {
        // no-op
    }
}
