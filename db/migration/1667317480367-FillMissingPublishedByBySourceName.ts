import { MigrationInterface, QueryRunner } from "typeorm"

export class FillMissingPublishedByBySourceName1667317480367
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE sources
            SET description = JSON_SET(description, '$.dataPublishedBy', name)
            where
            (
                description->'$.dataPublishedBy' = CAST('null' AS JSON) or
                description->'$.dataPublishedBy' is null or
                description->'$.dataPublishedBy' = ""
            )`)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // no going back...
    }
}
