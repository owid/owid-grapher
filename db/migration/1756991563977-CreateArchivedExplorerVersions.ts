import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateArchivedExplorerVersions1756991563977
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE archived_explorer_versions (
                id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
                archivalTimestamp TIMESTAMP NOT NULL,
                -- Not a FK because we want to keep explorers archived
                -- even after they're deleted.
                explorerSlug VARCHAR(150) NOT NULL,
                hashOfInputs VARCHAR(255) NOT NULL,
                manifest JSON,

                -- Useful for querying the latest version of an explorer.
                UNIQUE INDEX idx_explorerSlug_archivalTimestamp (explorerSlug, archivalTimestamp),
                INDEX idx_timestamp (archivalTimestamp),
                INDEX idx_hashOfInputs (hashOfInputs)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE archived_explorer_versions
        `)
    }
}
