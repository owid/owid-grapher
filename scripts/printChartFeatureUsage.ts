#!/usr/bin/env yarn tsn

import * as db from "db/db"
import { Chart } from "db/model/Chart"
import * as fs from "fs"

const getChartFeatureUsage = async () => {
    const allCharts = await Chart.all()
    const featureUsage = allCharts.map(chartRow => {
        const config: any = chartRow.config
        const result: any = {}
        // Create a nice flat structure that will convert easily to a table for analysis
        Object.keys(config).forEach(key => {
            const value = config[key]
            if (Array.isArray(value)) result[key] = value.length
            else if (!(value instanceof Object)) result[key] = value
            else
                Object.keys(value).forEach(subKey => {
                    const subValue = value[subKey]
                    const subKeyPath = `${key}.${subKey}`
                    if (Array.isArray(subValue))
                        result[subKeyPath] = subValue.length
                    else if (!(subValue instanceof Object))
                        result[subKeyPath] = subValue
                })
        })
        // I needed to find charts with log/linear switching AND comparison line labels so added this column
        result.comparisonLineLabels = config.comparisonLines
            ? config.comparisonLines.filter((line: any) => line.label).length
            : 0
        return result
    })

    await db.end()
    return featureUsage
}

const saveFeatureUsage = async (outputPath: string) => {
    const report = await getChartFeatureUsage()
    console.log(`Saving to ${outputPath}`)
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
}

saveFeatureUsage(process.argv[2])
