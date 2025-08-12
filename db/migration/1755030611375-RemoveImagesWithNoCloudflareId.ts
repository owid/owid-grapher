import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveImagesWithNoCloudflareId1755030611375
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE FROM images 
            WHERE cloudflareId IS NULL
        `)
    }

    public async down(_: QueryRunner): Promise<void> {
        // n/a, would have to restore from backup
    }
}
