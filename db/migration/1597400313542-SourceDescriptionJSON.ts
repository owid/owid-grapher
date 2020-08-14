import { MigrationInterface, QueryRunner } from "typeorm"

export class SourceDescriptionJSON1597400313542 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(
            "ALTER TABLE `sources` CHANGE `description` `description` json NOT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(
            "ALTER TABLE `sources` CHANGE `description` `description` longtext NOT NULL"
        )
    }
}
