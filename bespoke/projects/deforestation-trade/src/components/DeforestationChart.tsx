import { articulateEntity } from "@ourworldindata/utils"

import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { TradeRow, View } from "../core/types.js"
import { possessiveEntity } from "../core/helpers.js"
import { DeforestationSankey } from "./DeforestationSankey.js"

export interface DeforestationChartProps {
    /** Which half of the country's flows to show. */
    view: View
    /** The country on screen. */
    country: string
    year: number
    /** Producer → group flows for `year`: who produced the deforestation
     *  embedded in what this country consumes. */
    importRows: TradeRow[]
    /** Group → consumer flows for `year`: who consumes what this country
     *  produced. */
    exportRows: TradeRow[]
    /** Hectares the current view sums to, for shares and labels. */
    total: number
    /** A new selection is loading while the previous one stays on screen. */
    isLoading?: boolean
    /** Clicking a partner node selects it. */
    setCountry: (name: string) => void
    /** Clicking through from one half of the chart to the other. */
    setView: (view: View) => void
    isNarrow?: boolean
}

export function DeforestationChart({
    view,
    country,
    year,
    importRows,
    exportRows,
    isLoading,
    setCountry,
    setView,
    isNarrow,
}: DeforestationChartProps): React.ReactElement {
    // Both halves are empty when the selection has no recorded flows at all:
    // the variant has already coerced `view` to whichever half has data, so a
    // one-sided country still renders a chart.
    const hasNoData = importRows.length === 0 && exportRows.length === 0

    return (
        <div className="deforestation-captioned-chart__chart-area">
            {isLoading && <Spinner />}
            {hasNoData ? (
                <NoData country={country} year={year} />
            ) : (
                <DeforestationSankey
                    view={view}
                    country={country}
                    year={year}
                    importRows={importRows}
                    exportRows={exportRows}
                    setCountry={setCountry}
                    setView={setView}
                    isNarrow={isNarrow}
                />
            )}
        </div>
    )
}

function NoData({
    country,
    year,
}: {
    country: string
    year: number
}): React.ReactElement {
    return (
        <div className="deforestation-captioned-chart__empty">
            <p className="deforestation-captioned-chart__empty-message">
                No deforestation embedded in{" "}
                {possessiveEntity(articulateEntity(country))} trade was recorded
                in {year}.
            </p>
        </div>
    )
}
