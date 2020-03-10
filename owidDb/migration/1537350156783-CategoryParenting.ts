import { MigrationInterface, QueryRunner } from "typeorm"

export class CategoryParenting1537350156783 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const now = new Date()
        await queryRunner.query(
            "ALTER TABLE tags CHANGE categoryId parentId INTEGER DEFAULT NULL;"
        )
        await queryRunner.query(
            "ALTER TABLE tags ADD isBulkImport BOOLEAN NOT NULL DEFAULT FALSE"
        )
        await queryRunner.query(
            "ALTER TABLE tags DROP FOREIGN KEY `dataset_subcategorie_categoryId_cd02a9e3_fk_dataset_c`;"
        )

        for (const category of await queryRunner.query(
            "SELECT * FROM dataset_categories ORDER BY id ASC"
        )) {
            const result = await queryRunner.query(
                "INSERT INTO tags (name, createdAt, updatedAt, isBulkImport) VALUES (?, ?, ?, ?)",
                [category.name, now, now, category.fetcher_autocreated]
            )

            await queryRunner.query(
                "UPDATE tags SET parentId=? WHERE parentId=?",
                [result.insertId, category.id]
            )
        }

        await queryRunner.query(
            "ALTER TABLE tags ADD FOREIGN KEY (parentId) REFERENCES tags(id)"
        )
        await queryRunner.query("DROP TABLE dataset_categories")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
