import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGrapherConfigColumnToVariables1636723590540
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE variables
        ADD COLUMN grapherConfig json
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE variables
        DROP COLUMN grapherConfig
        `)
    }
}
