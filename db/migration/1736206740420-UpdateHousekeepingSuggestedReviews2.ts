import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateHousekeepingSuggestedReviews21736206740420
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE housekeeping_suggested_reviews DROP INDEX objectType;
        `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
