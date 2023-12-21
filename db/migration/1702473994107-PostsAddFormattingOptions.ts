import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsAddFormattingOptions1702473994107
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // add json column formattingOptions to posts mysql table
        await queryRunner.query(
            "ALTER TABLE posts ADD COLUMN formattingOptions JSON"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // remove json column formattingOptions from posts mysql table
        await queryRunner.query(
            "ALTER TABLE posts DROP COLUMN formattingOptions"
        )
    }
}
