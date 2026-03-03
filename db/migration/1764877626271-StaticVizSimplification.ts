import { MigrationInterface, QueryRunner } from "typeorm"

export class StaticVizSimplification1764877626271 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename slug column to name
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            CHANGE COLUMN slug name varchar(255) NOT NULL
        `)

        // Drop the old unique key constraint on slug
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            DROP INDEX uk_static_viz_slug
        `)

        // Add new unique key constraint on name
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            ADD UNIQUE KEY uk_static_viz_name (name)
        `)

        // Drop the title column
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            DROP COLUMN title
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Add title column back
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            ADD COLUMN title varchar(500) NOT NULL AFTER name
        `)

        // Drop the unique key constraint on name
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            DROP INDEX uk_static_viz_name
        `)

        // Add back the unique key constraint on slug
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            ADD UNIQUE KEY uk_static_viz_slug (name)
        `)

        // Rename name column back to slug
        await queryRunner.query(`-- sql
            ALTER TABLE static_viz
            CHANGE COLUMN name slug varchar(255) NOT NULL
        `)
    }
}
