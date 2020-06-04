import { flatten, uniq, sortBy, extend, csvEscape, last, first } from "./Util"
import { Bounds } from "./Bounds"
import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "./ChartConfig"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { DataTable } from "./DataTable"
import { DATA_TABLE } from "settings"

// Client-side data export from chart
@observer
export class DataTab extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
}> {
    @computed get bounds() {
        return this.props.bounds
    }

    // Here's where the actual CSV is made
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

    render() {
        const { bounds, csvFilename } = this

        const externalCsvLink = this.props.chart.externalCsvLink

        return (
            <div
                className="dataTab"
                style={extend(bounds.toCSS(), { position: "absolute" })}
            >
                {DATA_TABLE ? (
                    <div
                        style={{
                            maxWidth: "100%",
                            height: "100%",
                            overflow: "auto"
                        }}
                    >
                        <DataTable chart={this.props.chart} />
                    </div>
                ) : (
                    <div style={{ maxWidth: "100%" }}>
                        <p>
                            Download a CSV file containing all data used in this
                            visualization:
                        </p>
                        <a
                            href={
                                externalCsvLink
                                    ? externalCsvLink
                                    : this.csvDataUri
                            }
                            download={csvFilename}
                            className="btn btn-primary"
                            data-track-note="chart-download-csv"
                            onClick={
                                externalCsvLink ? undefined : this.onDownload
                            }
                        >
                            <FontAwesomeIcon icon={faDownload} /> {csvFilename}
                        </a>
                    </div>
                )}
            </div>
        )
    }

    // returns true if given dimension is year-based in a chart with day-based variable
    private isFixedYearDimension(dim: ChartDimensionWithOwidVariable) {
        return this.props.chart.yearIsDayVar && !dim.yearIsDayVar
    }
}
