import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplorerViewsTable1746446180336 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE explorer_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                explorerSlug varchar(255) NOT NULL,
                explorerView json NOT NULL,
                grapherConfig json NOT NULL
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE explorer_views
        `)
    }
}
