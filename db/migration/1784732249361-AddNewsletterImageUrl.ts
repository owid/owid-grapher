import { MigrationInterface, QueryRunner } from "typeorm"

export class AddNewsletterImageUrl1784732249361 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE newsletters ADD COLUMN imageUrl VARCHAR(1024) NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE newsletters DROP COLUMN imageUrl`)
    }
}
