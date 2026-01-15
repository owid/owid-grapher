import { MigrationInterface, QueryRunner } from "typeorm"

export class DropParentIdFromTags1768518407888 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE tags
            DROP INDEX dataset_subcategories_name_fk_dst_cat_id_6ce1cc36_uniq
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE tags
            DROP FOREIGN KEY tags_ibfk_1
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE tags
            DROP COLUMN parentId
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE tags
            ADD COLUMN parentId INT DEFAULT NULL
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE tags
            ADD CONSTRAINT tags_ibfk_1 FOREIGN KEY (parentId) REFERENCES tags (id)
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE tags
            ADD UNIQUE INDEX dataset_subcategories_name_fk_dst_cat_id_6ce1cc36_uniq (name, parentId)
        `)

        // Repopulate parentId from tag_graph (first parent only, excluding root)
        await queryRunner.query(`-- sql
            UPDATE tags t
            JOIN tag_graph tg ON tg.childId = t.id
            SET t.parentId = tg.parentId
            WHERE tg.parentId != (SELECT id FROM tags WHERE name = 'tag-graph-root')
        `)
    }
}
