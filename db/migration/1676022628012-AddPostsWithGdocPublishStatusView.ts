import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsWithGdocPublishStatusView1676022628012 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        create view posts_with_gdoc_publish_status as
            select p.*, pg.published as isGdocPublished from posts p
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
