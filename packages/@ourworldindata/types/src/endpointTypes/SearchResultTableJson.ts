import { GrapherTrendArrowDirection } from "../grapherTypes/GrapherTypes"

/** Type definition for data retrieved from the `/grapher/slug.search-result-table.json` endpoint */
export type SearchChartHitDataTableContent =
    | {
          type: "data-table"
          props: SearchChartHitDataTableProps
          isLegend?: boolean
      }
    | {
          type: "data-points"
          props: SearchChartHitDataPointsProps
      }

export interface SearchChartHitDataTableProps {
    rows: TableRow[]
    title: string
}

export interface SearchChartHitDataPointsProps {
    dataPoints: DataPoint[]
}

interface TableRow {
    seriesName?: string
    label: string
    color?: string
    value?: string
    startValue?: string
    time?: string
    timePreposition?: string
    muted?: boolean
    striped?: boolean | "no-data"
    outlined?: boolean
    trend?: GrapherTrendArrowDirection // only relevant if startValue is given
}

interface DataPoint {
    columnName: string
    unit?: string
    time: string
    entityName: string
    value: string
    startValue?: string
    trend?: GrapherTrendArrowDirection // only relevant if startValue is given
}
