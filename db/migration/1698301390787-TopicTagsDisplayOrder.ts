import { MigrationInterface, QueryRunner } from "typeorm"

export class TopicTagsDisplayOrder1698301390787 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE tags_variables_topic_tags
            ADD COLUMN displayOrder SMALLINT NOT NULL DEFAULT 0;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE tags_variables_topic_tags
            DROP COLUMN displayOrder;`
        )
    }
}
