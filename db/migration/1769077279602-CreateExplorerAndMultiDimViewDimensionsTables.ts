import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateExplorerAndMultiDimViewDimensionsTables1769077279602 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE explorer_view_dimensions (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                chartConfigId CHAR(36) NOT NULL,
                dimensions JSON NOT NULL,
                UNIQUE KEY (chartConfigId)
            )
        `)

        await queryRunner.query(`-- sql
            CREATE TABLE multi_dim_view_dimensions (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                chartConfigId CHAR(36) NOT NULL,
                dimensions JSON NOT NULL,
                UNIQUE KEY (chartConfigId)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE multi_dim_view_dimensions
        `)

        await queryRunner.query(`-- sql
            DROP TABLE explorer_view_dimensions
        `)
    }
}
