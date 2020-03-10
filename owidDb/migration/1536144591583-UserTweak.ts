import { MigrationInterface, QueryRunner } from "typeorm"

export class UserTweak1536144591583 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE charts ADD lastEditedByUserId INTEGER"
        )
        await queryRunner.query(
            "ALTER TABLE charts ADD publishedByUserId INTEGER"
        )

        await queryRunner.query(
            "UPDATE charts c JOIN users u ON u.name=c.lastEditedBy SET c.lastEditedByUserId=u.id"
        )
        await queryRunner.query(
            "UPDATE charts c JOIN users u ON u.name=c.publishedBy SET c.publishedByUserId=u.id"
        )

        await queryRunner.query(
            "ALTER TABLE `charts` ADD CONSTRAINT `charts_lastEditedByUserId` FOREIGN KEY (`lastEditedByUserId`) REFERENCES `users`(`id`)"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` ADD CONSTRAINT `charts_publishedByUserId` FOREIGN KEY (`publishedByUserId`) REFERENCES `users`(`id`)"
        )

        await queryRunner.query(
            "ALTER TABLE `charts` DROP FOREIGN KEY `FK_ebe44242cb70398fcb5af3c9316`"
        )
        await queryRunner.query(
            "ALTER TABLE `charts` DROP FOREIGN KEY `FK_b3879b5deca71fae207d0365257`"
        )

        await queryRunner.query("ALTER TABLE charts DROP COLUMN lastEditedBy")
        await queryRunner.query("ALTER TABLE charts DROP COLUMN publishedBy")

        await queryRunner.query(
            "ALTER TABLE users CHANGE last_login lastLogin DATETIME"
        )
        await queryRunner.query(
            "ALTER TABLE users CHANGE is_superuser isSuperuser BOOLEAN NOT NULL DEFAULT FALSE"
        )
        await queryRunner.query(
            "ALTER TABLE users CHANGE is_active isActive BOOLEAN NOT NULL DEFAULT TRUE"
        )
        await queryRunner.query(
            "ALTER TABLE users CHANGE full_name fullName VARCHAR(255) NOT NULL"
        )
        await queryRunner.query("ALTER TABLE users ADD lastSeen DATETIME")

        await queryRunner.query("ALTER TABLE variables DROP COLUMN uploaded_at")
        await queryRunner.query(
            "ALTER TABLE variables DROP FOREIGN KEY `variables_uploaded_by_565fdaca_fk_users_name`"
        )
        await queryRunner.query("ALTER TABLE variables DROP COLUMN uploaded_by")

        await queryRunner.query("ALTER TABLE users DROP COLUMN name")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
