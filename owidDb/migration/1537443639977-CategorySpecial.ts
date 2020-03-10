import { MigrationInterface, QueryRunner } from "typeorm"

export class CategorySpecial1537443639977 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE tags ADD COLUMN specialType VARCHAR(255) DEFAULT NULL"
        )
        await queryRunner.query(
            "UPDATE tags SET name='System', specialType='systemParent' WHERE name='Uncategorized' AND parentId IS NULL"
        )
        await queryRunner.query(
            "UPDATE tags SET specialType='uncategorized' WHERE name='Uncategorized'"
        )
        await queryRunner.query(
            "UPDATE tags SET isBulkImport=1 WHERE name='World Development Indicators'"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
