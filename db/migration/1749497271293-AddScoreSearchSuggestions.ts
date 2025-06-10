import { MigrationInterface, QueryRunner } from "typeorm"

export class AddScoreSearchSuggestions1749497271293
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE search_suggestions
            ADD COLUMN score SMALLINT AFTER suggestion
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE search_suggestions
            DROP COLUMN score
        `)
    }
}
