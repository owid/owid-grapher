import { MigrationInterface, QueryRunner } from "typeorm"

export class FixGdocPostsWithoutType1703777475319
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // This migration makes sure that all posts_gdocs have the type field
        // set in the content JSON blob. 'article' is not necessarily correct
        // but the next time this article is opened it will be updated to the
        // actual type in the gdoc. Because of the current code being too strict,
        // the same does not happen when opening a gdoc in the admin if the type
        // is missing, so this is a next-best workaround.
        await queryRunner.query(`-- sql
            update posts_gdocs
            set content = json_insert(content, '$.type', 'article')
            where content->>'$.type' is null;`)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return
    }
}
