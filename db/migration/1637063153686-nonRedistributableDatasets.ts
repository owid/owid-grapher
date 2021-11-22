import { MigrationInterface, QueryRunner } from "typeorm"

export class nonRedistributableDatasets1637063153686
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE datasets
                ADD COLUMN nonRedistributable BOOLEAN NOT NULL DEFAULT FALSE,
                ADD CONSTRAINT privateIfNonRedistributable CHECK (nonRedistributable IS FALSE OR isPrivate IS TRUE);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE datasets
                DROP CONSTRAINT privateIfNonRedistributable,
                DROP COLUMN nonRedistributable;
        `)
    }
}
