import { MigrationInterface, QueryRunner } from "typeorm"

export class DropWPGdocSuccessorId1748259562038 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            drop view if exists posts_with_gdoc_publish_status
        `)

        await queryRunner.query(`-- sql
            alter table posts drop column gdocSuccessorId,
            drop column archieml_update_statistics
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            alter table posts
            add column gdocSuccessorId varchar(255) after updated_at,
            add column archieml_update_statistics json after archieml
        `)

        await queryRunner.query(`-- sql
        create view posts_with_gdoc_publish_status as
            select p.*, pg.published as isGdocPublished from posts p
            left join posts_gdocs pg on p.gdocSuccessorId = pg.id COLLATE utf8mb4_0900_ai_ci
            order by pg.published desc
        `)
    }
}
