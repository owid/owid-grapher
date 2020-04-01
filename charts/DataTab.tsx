import { flatten, uniq, sortBy, extend, csvEscape } from "./Util"
import { Bounds } from "./Bounds"
import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "./ChartConfig"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

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
        const allUniqChartEntities = chart.uniqueEntitiesAcrossDimensions

        // only get days if chart has a day-indexed variable
        const indexingYears = sortBy(
            dayIndexedCSV
                ? yearIsDayVar?.yearsUniq
                : uniq(flatten(dimensions.map(d => d.yearsUniq)))
        )

        const rows: string[] = []

        const titleRow = [
            "Entity",
            "Code",
            chart.yearIsDayVar ? "Date" : "Year"
        ]

        dimensions.forEach(dim => {
            titleRow.push(csvEscape(dim.fullNameWithUnit))
        })
        rows.push(titleRow.join(","))

        allUniqChartEntities.forEach(entity => {
            indexingYears.forEach(year => {
                const row: (string | number)[] = [
                    entity,
                    chart.entityMetaByKey[entity].code ?? "",
                    chart.formatYearFunction(year)
                ]

                let rowHasSomeValue = false
                dimensions.forEach(dim => {
                    // If chart has day-based variables, only show latest value for year-based variables
                    const isFixedYearDimension =
                        dayIndexedCSV && !dim.yearIsDayVar

                    const value = isFixedYearDimension
                        ? dim.latestValueforEntity(entity)
                        : dim.valueByEntityAndYear.get(entity)?.get(year)

                    if (value) {
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
        const { bounds, csvDataUri, csvFilename } = this

        return (
            <div
                className="dataTab"
                style={extend(bounds.toCSS(), { position: "absolute" })}
            >
                <div style={{ maxWidth: "100%" }}>
                    <p>
                        Download a CSV file containing all data used in this
                        visualization:
                    </p>
                    <a
                        href={csvDataUri}
                        download={csvFilename}
                        className="btn btn-primary"
                        data-track-note="chart-download-csv"
                        onClick={this.onDownload}
                    >
                        <FontAwesomeIcon icon={faDownload} /> {csvFilename}
                    </a>
                </div>
            </div>
        )
    }
}
