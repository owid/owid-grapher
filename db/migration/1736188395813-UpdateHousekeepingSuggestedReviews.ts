import { MigrationInterface, QueryRunner } from "typeorm"

export class HousekeepingSuggestedReviews1736188395813
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE housekeeping_suggested_reviews
            MODIFY COLUMN objectId INTEGER NOT NULL;
        `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
