import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateArchivedMultiDimVersions1748952386738
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE archived_multi_dim_versions (
                id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
                archivalTimestamp TIMESTAMP NOT NULL,
                -- Not a FK because we want to keep multi-dim pages archived
                -- even after they're deleted.
                multiDimId INT NOT NULL,
                multiDimSlug VARCHAR(255) NOT NULL,
                hashOfInputs VARCHAR(255) NOT NULL,
                manifest JSON,

                -- Useful for querying the latest version of a multi-dim page.
                UNIQUE INDEX idx_multiDimId_archivalTimestamp (multiDimId, archivalTimestamp),
                INDEX idx_multiDimSlug (multiDimSlug),
                INDEX idx_timestamp (archivalTimestamp),
                INDEX idx_hashOfInputs (hashOfInputs)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE archived_multi_dim_versions
        `)
    }
}
