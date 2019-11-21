import { MigrationInterface, QueryRunner } from "typeorm"

export class OriginalMetadata1538047968257 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(
            "ALTER TABLE variables ADD COLUMN originalMetadata json DEFAULT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
