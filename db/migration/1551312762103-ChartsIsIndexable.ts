import {MigrationInterface, QueryRunner} from "typeorm";

export class ChartsIsIndexable1551312762103 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query("alter table charts ADD is_indexable BOOLEAN NOT NULL DEFAULT FALSE")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
