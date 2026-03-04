import { MigrationInterface, QueryRunner } from "typeorm"

export class RecreatePostsWithGdocPublishStatusSaferWithCoalesce1683308571747 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        drop view if exists posts_with_gdoc_publish_status;
        `)
        await queryRunner.query(`-- sql
        create view posts_with_gdoc_publish_status as
            select p.*, coalesce(pg.published, false) as isGdocPublished from posts p
            left join posts_gdocs pg on p.gdocSuccessorId = pg.id COLLATE utf8mb4_0900_ai_ci
            order by pg.published desc;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        drop view if exists posts_with_gdoc_publish_status;
        `)
    }
}
