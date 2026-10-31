import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCommentTargetKey1785524533701 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // targetId is an auto-increment key, which only identifies a row within
        // one database. Staging is cloned from production and then both keep
        // inserting, so a chart created on a branch can end up sharing an id
        // with an unrelated production chart. Record the target's portable
        // identity alongside it - a chart's config UUID, or the catalog path of
        // an indicator or multi-dim - so comments can later be moved between
        // environments without silently re-anchoring to the wrong thing.
        //
        // Nullable because legacy indicators have no catalogPath; we would
        // rather store a comment without a portable key than refuse it.
        await queryRunner.query(`-- sql
            ALTER TABLE comments
                ADD COLUMN targetKey VARCHAR(767) DEFAULT NULL AFTER targetId,
                ADD INDEX idx_comments_target_key (targetKey)
        `)

        // Backfill the comments that already exist
        await queryRunner.query(`-- sql
            UPDATE comments c
            JOIN charts ch ON ch.id = c.targetId
            SET c.targetKey = ch.configId
            WHERE c.targetType = 'chart'
        `)
        await queryRunner.query(`-- sql
            UPDATE comments c
            JOIN variables v ON v.id = c.targetId
            SET c.targetKey = v.catalogPath
            WHERE c.targetType = 'variable'
        `)
        await queryRunner.query(`-- sql
            UPDATE comments c
            JOIN multi_dim_data_pages m ON m.id = c.targetId
            SET c.targetKey = m.catalogPath
            WHERE c.targetType = 'multiDim'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE comments
                DROP INDEX idx_comments_target_key,
                DROP COLUMN targetKey
        `)
    }
}
