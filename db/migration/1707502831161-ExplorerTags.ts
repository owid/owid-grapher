import { MigrationInterface, QueryRunner } from "typeorm"

export class ExplorerTags1707502831161 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE explorer_tags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                explorerSlug VARCHAR(150) NOT NULL,
                tagId INT NOT NULL,
                UNIQUE KEY (explorerSlug, tagId),
                FOREIGN KEY (tagId) REFERENCES tags(id)
            );
        
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE IF EXISTS explorer_tags;
        `)
    }
}
