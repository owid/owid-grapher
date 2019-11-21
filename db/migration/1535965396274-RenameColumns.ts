import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameColumns1535965396274 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE variables DROP FOREIGN KEY `variables_variableTypeId_b1e5f096_fk_variable_types_id`"
        )
        await queryRunner.query(
            "ALTER TABLE variables DROP COLUMN variableTypeId"
        )
        await queryRunner.query("DROP TABLE variable_types")
        await queryRunner.query("DROP TABLE licenses")
        await queryRunner.query("DROP TABLE logos")

        await queryRunner.query(
            "ALTER TABLE datasets DROP FOREIGN KEY `datasets_categoryId_4687c291_fk_dataset_categories_id`"
        )
        await queryRunner.query(
            "ALTER TABLE datasets DROP FOREIGN KEY `datasets_subcategoryId_84676a81_fk_dataset_subcategories_id`"
        )
        await queryRunner.query(
            "ALTER TABLE datasets DROP COLUMN subcategoryId"
        )
        await queryRunner.query("ALTER TABLE datasets DROP COLUMN categoryId")

        await queryRunner.query("ALTER TABLE django_session RENAME TO sessions")
        await queryRunner.query("DROP TABLE django_migrations")
        await queryRunner.query("DROP TABLE django_admin_log")

        await queryRunner.query("DROP TABLE auth_group_permissions")
        await queryRunner.query("DROP TABLE users_user_permissions")
        await queryRunner.query("DROP TABLE auth_permission")
        await queryRunner.query("DROP TABLE users_groups")
        await queryRunner.query("DROP TABLE auth_group")

        await queryRunner.query("DROP TABLE django_content_type")

        await queryRunner.query(
            "ALTER TABLE tags CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE tags CHANGE updated_at updatedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE datasets CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE datasets CHANGE updated_at updatedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE variables CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE variables CHANGE updated_at updatedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE users CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE users CHANGE updated_at updatedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE dataset_categories CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE dataset_categories CHANGE updated_at updatedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE password_resets CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE updated_at updatedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE published_at publishedAt datetime"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE published_by publishedBy varchar(255)"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE last_edited_at lastEditedAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE last_edited_by lastEditedBy varchar(255)"
        )
        await queryRunner.query(
            "ALTER TABLE sources CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE sources CHANGE updated_at updatedAt datetime NOT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
