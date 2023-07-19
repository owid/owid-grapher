import { MigrationInterface, QueryRunner } from "typeorm"

export class LinkQueryString1689019238688 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links ADD COLUMN queryString VARCHAR(2047) NOT NULL;`
        )
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links ADD COLUMN hash VARCHAR(2047) NOT NULL;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links DROP COLUMN queryString;`
        )
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links DROP COLUMN hash;`
        )
    }
}
