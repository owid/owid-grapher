import { MigrationInterface, QueryRunner } from "typeorm"
import {
    createChartReferencesView,
    REFERENCE_SOURCES,
} from "../chartReferencesViewHelper.js"

export class UpdateChartReferencesViewForStaticViz1764277779348
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Recreate the chart_references_view to include static_viz references
        await createChartReferencesView(queryRunner, [
            REFERENCE_SOURCES.gdocs,
            REFERENCE_SOURCES.explorer,
            REFERENCE_SOURCES.staticViz,
        ])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate the view without static_viz references
        await createChartReferencesView(queryRunner, [
            REFERENCE_SOURCES.gdocs,
            REFERENCE_SOURCES.explorer,
        ])
    }
}
