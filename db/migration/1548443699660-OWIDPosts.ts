import {MigrationInterface, QueryRunner} from "typeorm";

export class OWIDPosts1548443699660 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `posts` (`id` bigint NOT NULL AUTO_INCREMENT, `title` text NOT NULL, `slug` text NOT NULL, `type` text NOT NULL, `status` text NOT NULL, `content` longtext NOT NULL, `published_at` datetime NULL, `updated_at` datetime NOT NULL, PRIMARY KEY(`id`)) ENGINE=InnoDB")
        await queryRunner.query("CREATE TABLE `post_tags` (`post_id` bigint NOT NULL, `tag_id` bigint NOT NULL, PRIMARY KEY (`post_id`, `tag_id`)) ENGINE=InnoDB")
        await queryRunner.query("ALTER TABLE `post_tags` ADD CONSTRAINT `FK_post_tags_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE")
        await queryRunner.query("ALTER TABLE `post_tags` ADD CONSTRAINT `FK_post_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `post_tags`")
        await queryRunner.query("DROP TABLE `posts`")
    }

}
