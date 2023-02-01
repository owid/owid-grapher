import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostColumnGdocSuccessorId1674140968484
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        ADD COLUMN gdocSuccessorId varchar(255)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        DROP COLUMN gdocSuccessorId
        `)
    }
}
