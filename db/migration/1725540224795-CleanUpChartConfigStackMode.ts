import { MigrationInterface, QueryRunner } from "typeorm"

export class CleanUpChartConfigStackMode1725540224795
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
          UPDATE chart_configs cc
          JOIN charts c ON c.configId = cc.id
          SET
              -- remove NULLs from the patch config
              cc.patch = JSON_REMOVE(cc.patch, '$.stackMode'),
              -- replace NULLs with the default value in the full config
              cc.full = JSON_REPLACE(cc.full, '$.stackMode', 'absolute')
          WHERE cc.patch ->> '$.stackMode' = 'null'
      `)
    }

    // eslint-disable-next-line
    public async down(queryRunner: QueryRunner): Promise<void> {}
}
