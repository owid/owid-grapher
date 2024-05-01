import { MigrationInterface, QueryRunner } from "typeorm"

export class SplitHideTitleAnnotationIntoMultipleFlags1678783599815
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(config, "$.hideAnnotationFieldsInTitle", JSON_OBJECT("entity", TRUE, "time", TRUE, "changeInPrefix", TRUE)),
                config = JSON_REMOVE(config, "$.hideTitleAnnotation")
            WHERE config->>"$.hideTitleAnnotation" = "true"
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(config, "$.hideTitleAnnotation", TRUE),
                config = JSON_REMOVE(config, "$.hideAnnotationFieldsInTitle")
            WHERE (
                config->>"$.hideAnnotationFieldsInTitle.entity" = "true"
                OR config->>"$.hideAnnotationFieldsInTitle.time" = "true"
                OR config->>"$.hideAnnotationFieldsInTitle.changeInPrefix" = "true"
            )
        `)
    }
}
