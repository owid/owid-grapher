import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplorerConfigMd51756993313186 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE explorers 
            ADD COLUMN configMd5 CHAR(24) GENERATED ALWAYS AS (to_base64(unhex(md5(config)))) STORED NOT NULL AFTER config
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE explorers 
            DROP COLUMN configMd5
        `)
    }
}
