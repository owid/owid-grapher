import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveTagsBulkImport1713987607342 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // We need to run this query twice: There's a tags.parentId -> tags.id
        // relation that we need to break in two steps; first deleting all the
        // leaf tags, and then deleting those that used to be a parent but are
        // now child-less.
        for (let i = 0; i <= 1; i++) {
            await queryRunner.query(`-- sql
            WITH leaf_tags AS (
                SELECT t.id, t.name
                FROM tags t
                WHERE t.id NOT IN (
                    SELECT parentId FROM tags WHERE parentId IS NOT NULL        
            ))
            DELETE
            FROM tags
            WHERE isBulkImport = 1
            and id IN (SELECT id FROM leaf_tags)
        `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
