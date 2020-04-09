import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveExternalDataUrlProp1585944897723
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(`
            UPDATE charts
            SET config = JSON_REMOVE(config, "$.externalDataUrl")
            WHERE config->"$.externalDataUrl" IS NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
