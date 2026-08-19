import { MigrationInterface, QueryRunner } from "typeorm"

export class AddBoostInSearchToFeaturedMetrics1778869323968 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE featured_metrics
              ADD COLUMN boostInSearch TINYINT(1) NOT NULL DEFAULT 0;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE featured_metrics
              DROP COLUMN boostInSearch;
        `)
    }
}
