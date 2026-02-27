import { MigrationInterface, QueryRunner } from "typeorm"

// We have to recreate this because new columns were added in the
// AddUpdatedAtInWordpressToPosts1676042584151 and AddCreatedAtToPosts1676470290267
// migrations
export class RecreatePostsWithGdocPublishStatusView1678398619296 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        drop view if exists posts_with_gdoc_publish_status;
        `)
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
