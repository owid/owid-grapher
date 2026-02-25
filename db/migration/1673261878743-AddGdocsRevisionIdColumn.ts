import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGdocsRevisionIdColumn1673261878743 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts_gdocs
        ADD COLUMN revisionId varchar(255) DEFAULT NULL;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts_gdocs
        DROP COLUMN revisionId;
        `)
    }
}
