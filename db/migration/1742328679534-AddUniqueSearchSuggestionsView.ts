import { MigrationInterface, QueryRunner } from "typeorm"

export class AddUniqueSearchSuggestionsView1742328679534
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE VIEW search_suggestions_unique AS
            SELECT DISTINCT LOWER(suggestion) AS suggestion
            FROM (
                SELECT jt.suggestion
                FROM search_suggestions,
                JSON_TABLE(search_suggestions.suggestions, '$[*]' COLUMNS (suggestion VARCHAR(255) PATH '$')) AS jt
            ) AS subquery
            ORDER BY suggestion;
            `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP VIEW IF EXISTS search_suggestions_unique;
        `)
    }
}
