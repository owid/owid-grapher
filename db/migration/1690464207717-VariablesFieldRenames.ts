import { MigrationInterface, QueryRunner } from "typeorm"

export class VariablesFieldRenames1690464207717 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE variables
                RENAME COLUMN citationInline TO attribution,
                RENAME COLUMN presentationLicense TO license;
                `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE variables
                RENAME COLUMN attribution TO citationInline,
                RENAME COLUMN license TO presentationLicense;
                `
        )
    }
}
