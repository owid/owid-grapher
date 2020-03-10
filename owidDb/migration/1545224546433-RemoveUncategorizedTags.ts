import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveUncategorizedTags1545224546433
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query("DELETE FROM dataset_tags WHERE tagId=375")
        queryRunner.query("DELETE FROM chart_tags WHERE tagId=375")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
