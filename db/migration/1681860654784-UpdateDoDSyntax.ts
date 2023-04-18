import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateDoDSyntax1681860654784 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`        
            UPDATE charts SET config = JSON_SET(config, '$.subtitle', JSON_UNQUOTE(REGEXP_REPLACE(JSON_EXTRACT(config, '$.subtitle'), 'hover::[a-z]+::', '#dod:')));
        `)
        await queryRunner.query(`        
            UPDATE charts SET config = JSON_SET(config, '$.note', JSON_UNQUOTE(REGEXP_REPLACE(JSON_EXTRACT(config, '$.note'), 'hover::[a-z]+::', '#dod:')));
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration removes category information so it can't be perfectly undone
        // e.g. hover::energy::nuclear -> #dod:nuclear
        // The best we can do is set all the categories to "general"
        await queryRunner.query(`        
            UPDATE charts SET config = JSON_SET(config, '$.subtitle', JSON_UNQUOTE(REGEXP_REPLACE(JSON_EXTRACT(config, '$.subtitle'), '#dod:', 'hover::general::')));
        `)
        await queryRunner.query(`        
            UPDATE charts SET config = JSON_SET(config, '$.note', JSON_UNQUOTE(REGEXP_REPLACE(JSON_EXTRACT(config, '$.note'), '#dod:', 'hover::general::')));
        `)
    }
}
