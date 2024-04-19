import { MigrationInterface, QueryRunner } from "typeorm"

export class ImageHeight1709135915963 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE images ADD COLUMN originalHeight INT NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE images DROP COLUMN originalHeight`)
    }
}
