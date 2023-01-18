import { MigrationInterface, QueryRunner } from "typeorm"

export class AddDataPathToVariables1674055678210 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              ADD COLUMN dataPath TEXT;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              DROP COLUMN dataPath;
            `
        )
    }
}
