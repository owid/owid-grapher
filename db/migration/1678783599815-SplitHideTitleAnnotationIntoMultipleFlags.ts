import { MigrationInterface, QueryRunner } from "typeorm"

export class SplitHideTitleAnnotationIntoMultipleFlags1678783599815
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            UPDATE charts
            SET config = JSON_REPLACE(config, "$.hideTitleAnnotation", JSON_OBJECT("entity", TRUE, "time", TRUE, "change", TRUE))
            WHERE config->"$.hideTitleAnnotation" IS true
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            UPDATE charts
            SET config = JSON_REPLACE(config, "$.hideTitleAnnotation", TRUE)
            WHERE (
                config->"$.hideTitleAnnotation.entity" IS TRUE
                OR config->"$.hideTitleAnnotation.time" IS TRUE
                OR config->"$.hideTitleAnnotation.change" IS TRUE
            )    
        `)
    }
}
