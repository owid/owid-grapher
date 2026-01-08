import { MigrationInterface, QueryRunner } from "typeorm"

export class DeactivateUsers1767886115566 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Deactivate users: Saloni Dattani (50), Simon van Teutem (80), Tina Rozsos (56)
        await queryRunner.query(`
            UPDATE users
            SET isActive = 0
            WHERE id IN (50, 80, 56);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE users
            SET isActive = 1
            WHERE id IN (50, 80, 56);
        `)
    }
}
