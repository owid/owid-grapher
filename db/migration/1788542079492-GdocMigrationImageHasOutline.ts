import { MigrationInterface, QueryRunner } from "typeorm"
import { applyGdocMigrationToDb } from "../gdocMigrations/dbApplier.js"
import migration from "../gdocMigrations/migrations/2026-09-image-has-outline.js"

export class GdocMigrationImageHasOutline1788542079492 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await applyGdocMigrationToDb(queryRunner, migration)
    }

    public async down(): Promise<void> {
        // Not reversible: an added `hasOutline: true` cannot be told apart
        // from one that was already stored, and a missing value parses to
        // true anyway, so there is nothing to restore.
    }
}
