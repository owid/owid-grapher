import { MigrationInterface, QueryRunner } from "typeorm"

export class AddIndicatorShortNameToCatalogPath1698087308654 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE variables
            SET catalogPath = CONCAT(catalogPath, '#', shortName)
            WHERE catalogPath not like '%#%';
            `
        )
        // change it from text to varchar for more efficient indexing, make it as long as possible
        // to fit into index
        await queryRunner.query(
            `ALTER TABLE variables
            MODIFY catalogPath VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
            `
        )
        await queryRunner.query(
            `ALTER TABLE variables
            ADD UNIQUE INDEX idx_catalogPath (catalogPath);
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            DROP INDEX idx_catalogPath
        `)
        await queryRunner.query(
            `UPDATE variables
            SET catalogPath = SUBSTRING_INDEX(catalogPath, '#', 1)
            WHERE catalogPath LIKE '%#%';
            `
        )
        await queryRunner.query(
            `ALTER TABLE variables
            MODIFY catalogPath text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
            `
        )
    }
}
