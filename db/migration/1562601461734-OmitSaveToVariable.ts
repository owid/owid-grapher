import { MigrationInterface, QueryRunner } from "typeorm"
import { GrapherScript } from "charts/core/GrapherScript"
import * as lodash from "lodash"

function omitSaveToVariable(config: GrapherScript): GrapherScript {
    const newConfig = lodash.clone(config)
    newConfig.dimensions = newConfig.dimensions.map(dim => {
        return lodash.omit(dim, ["saveToVariable"])
    })
    return newConfig
}

export class OmitSaveToVariable1562601461734 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const charts = (await queryRunner.query(
            "SELECT charts.id AS id, charts.config AS config FROM charts"
        )) as { id: number; config: string }[]

        for (const chart of charts) {
            const oldConfig = JSON.parse(chart.config)
            const newConfig = omitSaveToVariable(oldConfig)
            if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
                await queryRunner.query(
                    "UPDATE charts SET config = ? WHERE id = ?",
                    [JSON.stringify(newConfig), chart.id]
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
