import { MigrationInterface, QueryRunner } from "typeorm"

export class AddIsTopicToTag1692801236245 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE tags
            ADD COLUMN isTopic TINYINT(1) NOT NULL DEFAULT 0;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE tags
            DROP COLUMN isTopic;
        `)
    }
}
