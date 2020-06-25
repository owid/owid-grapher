import { computed, action } from "mobx"
import { ChartConfig } from "./ChartConfig"
import { uniq, flatten, csvEscape, first, last } from "./Util"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"

interface CSVGeneratorProps {
    chart: ChartConfig
}

interface TimeUnitDependentParams {
    indexingYears: number[]
    titleRow: string[]
}

export class CSVGenerator {
    props: CSVGeneratorProps
    constructor(props: CSVGeneratorProps) {
        this.props = props
    }

    @computed get chart() {
        return this.props.chart
    }

    @computed get csvDimensions() {
        return this.chart.data.filledDimensions.filter(
            d => d.property !== "color"
        )
    }

    /** Returns dimensions for which we want to show all values */
    @computed get allValueDimensions() {
        return this.csvDimensions.filter(
            dim => !this.isSingleValueDimension(dim)
        )
    }

    @computed get singleValueDimensions() {
        return this.csvDimensions.filter(dim =>
            this.isSingleValueDimension(dim)
        )
    }

    @computed get dayIndexedCSV() {
        return this.chart.yearIsDayVar ? true : false
    }

    @computed get yearIsDayVar() {
        return this.chart.yearIsDayVar
    }

    baseTitleRow = ["Entity", "Code"]

    @computed get dayBasedCSVParams(): TimeUnitDependentParams {
        const titleRow = this.baseTitleRow
        titleRow.push("Date")

        this.csvDimensions.map(dim => {
            if (this.isSingleValueDimension(dim)) titleRow.push("Year")
            titleRow.push(csvEscape(dim.fullNameWithUnit))
        })

        return {
            indexingYears: this.yearIsDayVar!.yearsUniq,
            titleRow: titleRow
        }
    }

    @computed get yearBasedCSVParams(): TimeUnitDependentParams {
        const titleRow = this.baseTitleRow
        titleRow.push("Year")

        this.csvDimensions.map(dim =>
            titleRow.push(csvEscape(dim.fullNameWithUnit))
        )

        return {
            indexingYears: uniq(
                flatten(this.csvDimensions.map(d => d.yearsUniq))
            ),
            titleRow: titleRow
        }
    }

    @computed get timeUnitDependentParams(): TimeUnitDependentParams {
        return this.dayIndexedCSV
            ? this.dayBasedCSVParams
            : this.yearBasedCSVParams
    }

    entityCode(entity: string) {
        return this.chart.entityMetaByKey[entity].code ?? ""
    }

    private formattedYear(year: number) {
        return this.chart.formatYearFunction(year)
    }

    private valueForDimensionEntityYear(
        dim: ChartDimensionWithOwidVariable,
        entity: string,
        year: number
    ) {
        return dim.valueByEntityAndYear.get(entity)?.get(year)
    }

    private yearAndValueForSingleYearDimension(
        dim: ChartDimensionWithOwidVariable,
        entity: string
    ): [string, string | number] | null {
        let latestYear = undefined
        let latestValue = undefined

        const latestYearValue = dim.yearAndValueOfLatestValueforEntity(entity)

        if (latestYearValue) {
            latestYear = dim.formatYear(first(latestYearValue) as number)
            latestValue = last(latestYearValue)
        }

        if (latestYear !== undefined && latestValue !== undefined) {
            return [latestYear, latestValue]
        } else return null
    }

    private dimensionsValues(entity: string, year: number) {
        const values: (string | number)[] = []

        this.allValueDimensions.map(dim => {
            const value = this.valueForDimensionEntityYear(dim, entity, year)

            if (value !== undefined) {
                values.push(value)
            } else values.push("")
        })

        this.singleValueDimensions.map(dim => {
            const yearAndValue = this.yearAndValueForSingleYearDimension(
                dim,
                entity
            )
            if (yearAndValue !== null) {
                values.push(...yearAndValue)
            } else values.push("", "")
        })
        return values
    }

    private row(entity: string, year: number) {
        const dimensionsValues = this.dimensionsValues(entity, year)
        const rowHasSomeValue = dimensionsValues.some(v => v !== "")

        if (rowHasSomeValue) {
            return [
                entity,
                this.entityCode(entity),
                this.formattedYear(year),
                ...dimensionsValues
            ]
        } else return null
    }

    @computed get dataRows() {
        const { indexingYears } = this.csvParams
        const chartEntities = this.chart.sortedUniqueEntitiesAcrossDimensions

        const rows: (string | number)[][] = []
        chartEntities.map(entity => {
            indexingYears.map(year => {
                const row = this.row(entity, year)
                if (row) rows.push(row)
            })
        })

        return rows
    }

    @computed get csvRows() {
        const { csvParams, dataRows: dataRows } = this
        return [csvParams.titleRow, ...dataRows.map(row => row.map(csvEscape))]
            .map(row => row.join(","))
            .join("\n")
    }

    @computed get csvBlob() {
        return new Blob([this.csvRows], { type: "text/csv" })
    }

    @computed get csvDataUri(): string {
        return window.URL.createObjectURL(this.csvBlob)
    }

    @computed get csvFilename(): string {
        return this.chart.data.slug + ".csv"
    }

    // IE11 compatibility
    @action.bound onDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(this.csvBlob, this.csvFilename)
            ev.preventDefault()
        }
    }

    /** Returns true for dimensions for which we want to show a single value.
     *
     * e.g. in a scatter plot with day-based variables and year-based variables,
     * show only one value for the year-based variables
     */
    private isSingleValueDimension(dim: ChartDimensionWithOwidVariable) {
        return this.chart.yearIsDayVar && !dim.yearIsDayVar
    }
}
