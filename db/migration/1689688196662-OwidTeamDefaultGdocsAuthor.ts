import { MigrationInterface, QueryRunner } from "typeorm"

export class OwidTeamDefaultGdocsAuthor1689688196662 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE posts_gdocs 
            SET content = JSON_REPLACE(content, '$.authors[0]', 'Our World in Data team') 
            WHERE JSON_CONTAINS(content -> '$.authors', '"Our World In Data"')
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE posts_gdocs 
            SET content = JSON_REPLACE(content, '$.authors[0]', 'Our World In Data') 
            WHERE JSON_CONTAINS(content -> '$.authors', '"Our World in Data team"')
        `)
    }
}
