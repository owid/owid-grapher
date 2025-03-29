import { MigrationInterface, QueryRunner } from "typeorm"

export class AddSearchSuggestionsTable1742232315341
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE search_suggestions (
                id int NOT NULL AUTO_INCREMENT,
                imageUrl varchar(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                suggestions JSON NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY unique_imageUrl (imageUrl)
            ) ENGINE=InnoDB;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE search_suggestions;
        `)
    }
}
