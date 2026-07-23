import { MigrationInterface, QueryRunner } from "typeorm"

export class AddQueryParamsToMultiDimRedirects1783083128496 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_redirects
                ADD COLUMN sourceQueryParams JSON NULL AFTER source,
                DROP INDEX source, -- changing from unique index...
                ADD INDEX source (source) -- ... to non-unique index
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_redirects
                DROP COLUMN sourceQueryParams,
                DROP INDEX source,
                ADD UNIQUE KEY source (source)
        `)
    }
}
