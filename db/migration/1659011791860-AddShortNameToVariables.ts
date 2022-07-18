import { MigrationInterface, QueryRunner } from "typeorm"

export class AddShortNameToVariables1659011791860
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            ADD COLUMN shortName VARCHAR(255)
            DEFAULT NULL;
        `)
        await queryRunner.query(`
            ALTER TABLE variables ADD UNIQUE (shortName);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            DROP COLUMN shortName;
        `)
    }
}
