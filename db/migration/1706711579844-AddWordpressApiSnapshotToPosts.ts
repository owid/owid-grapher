import { MigrationInterface, QueryRunner } from "typeorm"

export class AddWordpressApiSnapshotToPosts1706711579844
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts ADD wpApiSnapshot JSON DEFAULT NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts DROP COLUMN wpApiSnapshot`)
    }
}
