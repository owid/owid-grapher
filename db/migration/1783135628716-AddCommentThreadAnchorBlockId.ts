import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCommentThreadAnchorBlockId1783135628716
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Block-anchored comment threads reference the rich editor's stable
        // block ids (the enriched block's `id`, present in native drafts)
        // instead of ProseMirror positions, so they survive edits, reseeds
        // and restores.
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_comment_threads
            ADD COLUMN anchorBlockId VARCHAR(32) NULL AFTER anchorType
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_comment_threads
            DROP COLUMN anchorBlockId
        `)
    }
}
