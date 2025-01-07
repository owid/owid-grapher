import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveHousekeepingSuggestedReviews1736209759039
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE IF EXISTS housekeeping_suggested_reviews`
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(_queryRunner: QueryRunner): Promise<void> {
        return
    }
}
