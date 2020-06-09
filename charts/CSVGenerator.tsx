import { computed, action } from "mobx"
import { ChartConfig } from "./ChartConfig"
import { sortBy, uniq, flatten, csvEscape, first, last } from "./Util"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"

interface CSVGeneratorProps {
    chart: ChartConfig
}

export class CSVGenerator {
    props: CSVGeneratorProps
    constructor(props: CSVGeneratorProps) {
        this.props = props
    }

    @computed get csvBlob() {
        const { chart } = this.props
        const yearIsDayVar = chart.yearIsDayVar
        const dayIndexedCSV = yearIsDayVar ? true : false

        const dimensions = chart.data.filledDimensions.filter(
            d => d.property !== "color"
        )
        const uniqueEntitiesAcrossDimensions =
            chart.sortedUniqueEntitiesAcrossDimensions

        // only get days if chart has a day-indexed variable, else get years across dimensions
        const indexingYears = sortBy(
            dayIndexedCSV
                ? yearIsDayVar?.yearsUniq
                : uniq(flatten(dimensions.map(d => d.yearsUniq)))
        )

        const rows: string[] = []

        const titleRow = ["Entity", "Code", dayIndexedCSV ? "Date" : "Year"]

        dimensions.forEach(dim => {
            if (this.isFixedYearDimension(dim)) titleRow.push("Year")
            titleRow.push(csvEscape(dim.fullNameWithUnit))
        })
        rows.push(titleRow.join(","))

        uniqueEntitiesAcrossDimensions.forEach(entity => {
            indexingYears.forEach(year => {
                const row: (string | number)[] = [
                    entity,
                    chart.entityMetaByKey[entity].code ?? "",
                    chart.formatYearFunction(year)
                ]

                let rowHasSomeValue = false
                dimensions.forEach(dim => {
                    let value = null
                    if (this.isFixedYearDimension(dim)) {
                        const latestYearValue = dim.yearAndValueOfLatestValueforEntity(
                            entity
                        )
                        if (latestYearValue) {
                            row.push(
                                dim.formatYear(first(latestYearValue) as number)
                            )
                            value = last(latestYearValue)
                        } else row.push("")
                    } else {
                        value = dim.valueByEntityAndYear.get(entity)?.get(year)
                    }

                    if (value != null) {
                        row.push(value)
                        rowHasSomeValue = true
                    } else row.push("")
                })

                // Only add rows which actually have some data in them
                if (rowHasSomeValue) rows.push(row.map(csvEscape).join(","))
            })
        })

        return new Blob([rows.join("\n")], { type: "text/csv" })
    }

    @computed get csvDataUri(): string {
        return window.URL.createObjectURL(this.csvBlob)
    }

    @computed get csvFilename(): string {
        return this.props.chart.data.slug + ".csv"
    }

    // IE11 compatibility
    @action.bound onDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(this.csvBlob, this.csvFilename)
            ev.preventDefault()
        }
    }

    // returns true if given dimension is year-based in a chart with day-based variable
    private isFixedYearDimension(dim: ChartDimensionWithOwidVariable) {
        return this.props.chart.yearIsDayVar && !dim.yearIsDayVar
    }
}
