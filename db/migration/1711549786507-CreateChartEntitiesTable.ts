import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChartEntitiesTable1711549786507
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE charts_x_entities (
                chartId integer NOT NULL,
                entityId integer NOT NULL,

                FOREIGN KEY (chartId) REFERENCES charts (id) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (entityId) REFERENCES entities (id) ON DELETE RESTRICT ON UPDATE RESTRICT,

                PRIMARY KEY (chartId, entityId),

                -- we can use the primary key to look up by chartId, but might also want fast
                -- lookups by entityId, so we add an index explicitly
                INDEX (entityId)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE charts_x_entities`)
    }
}
