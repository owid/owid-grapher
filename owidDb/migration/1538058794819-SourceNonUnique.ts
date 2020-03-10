import { MigrationInterface, QueryRunner } from "typeorm"

export class SourceNonUnique1538058794819 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(
            "ALTER TABLE sources DROP INDEX `sources_name_datasetId_73238c38_uniq`"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
