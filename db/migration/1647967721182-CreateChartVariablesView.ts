import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChartVariablesView1647967721182
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE OR REPLACE VIEW chart_variables AS (
-- get the map variables that are not null
SELECT
	id as chartId,
	config ->> '$.map.variableId' as variableId
FROM
	charts
WHERE
	config ->> '$.map.variableId' is not null
UNION DISTINCT
-- and union it together with all the variables hidden in the dimensions json array, extracted with json_table
SELECT
	id as chartId,
	dims.variableId as variableId
FROM
	charts AS c
CROSS JOIN
JSON_TABLE(
  c.config,
	'$.dimensions[*]'
  COLUMNS(
    variableId INT PATH '$.variableId'
  )
) AS dims);`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW chart_variables;`)
    }
}
