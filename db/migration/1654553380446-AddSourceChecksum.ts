import { MigrationInterface, QueryRunner } from "typeorm"

export class AddSourceChecksum1654553380446 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
			ALTER TABLE datasets 
			ADD COLUMN sourceChecksum VARCHAR(64) 
			DEFAULT NULL;
    	`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
			ALTER TABLE datasets 
			DROP COLUMN sourceChecksum;
    	`)
    }
}
