import { MigrationInterface, QueryRunner } from "typeorm"

export class DatasetFiles1536211651024 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE TABLE `dataset_files` (`datasetId` int NOT NULL, `filename` VARCHAR(255) NOT NULL, `file` LONGBLOB NOT NULL) ENGINE=InnoDB"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
