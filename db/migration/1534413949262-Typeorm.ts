import { MigrationInterface, QueryRunner } from "typeorm"

export class Typeorm1534413949262 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE `user_invitations` DROP FOREIGN KEY `user_invitations_user_id_29cac16b_fk_users_id`"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` DROP FOREIGN KEY `charts_last_edited_by_791cce39_fk_users_name`"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` DROP FOREIGN KEY `charts_published_by_e3f4abdf_fk_users_name`"
        )
        await queryRunner.query(
            "ALTER TABLE `user_invitations` DROP COLUMN `user_id`"
        )
        await queryRunner.query(
            "ALTER TABLE `user_invitations` DROP COLUMN `status`"
        )
        await queryRunner.query(
            "UPDATE users SET full_name='' WHERE full_name IS NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `users` CHANGE `full_name` `full_name` varchar(255) NOT NULL DEFAULT ''"
        )
        await queryRunner.query(
            "ALTER TABLE `users` CHANGE `is_active` `is_active` tinyint NOT NULL DEFAULT 1"
        )
        await queryRunner.query(
            "ALTER TABLE `users` CHANGE `is_superuser` `is_superuser` tinyint NOT NULL DEFAULT 0"
        )
        await queryRunner.query(
            "ALTER TABLE `users` CHANGE `created_at` `created_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `users` CHANGE `updated_at` `updated_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `user_invitations` CHANGE `valid_till` `valid_till` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `user_invitations` CHANGE `created_at` `created_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `user_invitations` CHANGE `updated_at` `updated_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` CHANGE `last_edited_at` `last_edited_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` CHANGE `published_at` `published_at` datetime NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` CHANGE `created_at` `created_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` CHANGE `updated_at` `updated_at` datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` CHANGE `starred` `starred` tinyint NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` ADD CONSTRAINT `FK_ebe44242cb70398fcb5af3c9316` FOREIGN KEY (`last_edited_by`) REFERENCES `users`(`name`)"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` ADD CONSTRAINT `FK_b3879b5deca71fae207d0365257` FOREIGN KEY (`published_by`) REFERENCES `users`(`name`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error("Unsupported")
    }
}
