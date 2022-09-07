import { MigrationInterface, QueryRunner } from "typeorm"

export class ChannelToDatasets1662649702030 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE datasets
              ADD COLUMN channel VARCHAR(255);`
        )
        // NOTE: it would be nice to have unique constraint on combination, but
        // it errors on `Specified key was too long; max key length is 3072 bytes`
        // ADD CONSTRAINT unique_catalogPath UNIQUE (channel, namespace, version, shortName);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // await queryRunner.query(`
        //     ALTER TABLE datasets
        //     DROP INDEX unique_catalogPath
        // `)
        await queryRunner.query(`
            ALTER TABLE datasets
            DROP COLUMN channel;
        `)
    }
}
