import { getConnection } from "../../db/db.js"
import { Chart } from "../../db/model/Chart.js"
import fs from "fs-extra"

export default async function indexToKv() {
    const db = await getConnection()
    const charts = await Chart.all()

    const allCharts = []
    for (const chart of charts) {
        if (chart.config.isPublished) {
            const configJson = JSON.stringify(chart.config)
            allCharts.push(
                { key: chart.config.slug, value: configJson },
                { key: `${chart.id}`, value: configJson }
            )
        }
    }
    await fs.writeFile("charts.json", JSON.stringify(allCharts, null, 2))
    console.log("Done!")
}

indexToKv()
