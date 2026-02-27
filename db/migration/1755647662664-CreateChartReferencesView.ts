import { MigrationInterface, QueryRunner } from "typeorm"
import {
    createChartReferencesView,
    dropChartReferencesView,
    REFERENCE_SOURCES,
} from "../chartReferencesViewHelper.js"

export class CreateChartReferencesView1755647662664 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await createChartReferencesView(queryRunner, [
            REFERENCE_SOURCES.gdocs,
            REFERENCE_SOURCES.explorer,
        ])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropChartReferencesView(queryRunner)
    }
}
