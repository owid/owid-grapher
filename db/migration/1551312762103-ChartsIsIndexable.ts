import { MigrationInterface, QueryRunner } from "typeorm"
import _ = require("lodash")
import { PUBLIC_TAG_PARENT_IDS } from "settings"

export class ChartsIsIndexable1551312762103 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "alter table charts ADD is_indexable BOOLEAN NOT NULL DEFAULT FALSE"
        )

        const chartTags = (await queryRunner.query(
            "select ct.chartId, t.parentId from chart_tags ct join tags t on ct.tagId = t.id"
        )) as { chartId: number; parentId: number }[]

        for (const ct of chartTags) {
            if (PUBLIC_TAG_PARENT_IDS.includes(ct.parentId)) {
                await queryRunner.query(
                    "update charts set is_indexable = ? where id = ?",
                    [true, ct.chartId]
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
