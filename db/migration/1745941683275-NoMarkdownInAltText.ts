import { MigrationInterface, QueryRunner } from "typeorm"

export class NoMarkdownInAltText1745941683275 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE images
            SET defaultAlt = REPLACE(defaultAlt, '**', '')
            WHERE defaultAlt LIKE '%**%'
        `)
    }

    public async down(_: QueryRunner): Promise<void> {
        // no-op
    }
}
