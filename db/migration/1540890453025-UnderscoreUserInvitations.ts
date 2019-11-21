import { MigrationInterface, QueryRunner } from "typeorm"

export class UnderscoreUserInvitations1540890453025
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE user_invitations CHANGE valid_till validTill datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE user_invitations CHANGE created_at createdAt datetime NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE user_invitations CHANGE updated_at updatedAt datetime NOT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
