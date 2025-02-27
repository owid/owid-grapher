import { MigrationInterface, QueryRunner } from "typeorm"

export class AddArchivedChartVersionTable1738847640394
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE archived_chart_versions (
                id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
                archivalTimestamp TIMESTAMP NOT NULL,
                grapherId INT NOT NULL, -- theoretically this is a foreign key to charts(id), but charts may be deleted whereas archived_chart_versions should be kept forever
                grapherSlug VARCHAR(255) NOT NULL,
                hashOfInputs VARCHAR(255) NOT NULL,
                manifest JSON,

                UNIQUE INDEX idx_grapherId_archivalTimestamp (grapherId, archivalTimestamp), -- this kind of composite index is useful for querying the latest version of a chart
                INDEX idx_grapherSlug (grapherSlug),
                INDEX idx_timestamp (archivalTimestamp),
                INDEX idx_hashOfInputs (hashOfInputs)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE archived_chart_versions
        `)
    }
}
