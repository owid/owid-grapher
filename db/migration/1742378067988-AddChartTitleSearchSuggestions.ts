import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartTitleSearchSuggestions1742378067988
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add title column to search_suggestions table after imageUrl
        await queryRunner.query(`
            ALTER TABLE search_suggestions
            ADD COLUMN title VARCHAR(255) AFTER imageUrl
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the title column if migration is rolled back
        await queryRunner.query(`
            ALTER TABLE search_suggestions
            DROP COLUMN title
        `)
    }
}
