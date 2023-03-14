import { MigrationInterface, QueryRunner } from "typeorm"

export class SplitHideTitleAnnotationIntoMultipleFlags1678783599815
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(config, "$.hideTitleAnnotations", JSON_OBJECT("entity", TRUE, "time", TRUE, "change", TRUE)),
                config = JSON_REMOVE(config, "$.hideTitleAnnotation")
            WHERE config->"$.hideTitleAnnotation" IS true
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(config, "$.hideTitleAnnotation", TRUE),
                config = JSON_REMOVE(config, "$.hideTitleAnnotations")
            WHERE (
                config->"$.hideTitleAnnotations.entity" IS TRUE
                OR config->"$.hideTitleAnnotations.time" IS TRUE
                OR config->"$.hideTitleAnnotations.change" IS TRUE
            )    
        `)
    }
}
