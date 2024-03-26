import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsLinksLongerTargetField1696940352033
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links
            MODIFY target TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links
            MODIFY target varchar(2047) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL;`
        )
    }
}
