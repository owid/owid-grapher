import { MigrationInterface, QueryRunner } from "typeorm"

export class AddArchivedNamespaceColumn1601548270564
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE namespaces ADD isArchived BOOLEAN NOT NULL DEFAULT FALSE"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE namespaces DROP COLUMN isArchived")
    }
}
