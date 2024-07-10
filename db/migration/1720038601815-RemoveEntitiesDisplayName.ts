import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveEntitiesDisplayName1720038601815
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE entities
            DROP COLUMN displayName
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE entities
            ADD COLUMN displayName varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL
        `)
    }
}
