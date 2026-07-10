import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"

import {
    BASELINE_SCENARIO,
    ScenarioId,
    ScenarioSelection,
    VariantName,
} from "../helpers/PovertyProjectionsConstants.js"
import { ProjectionsData } from "../helpers/PovertyProjectionsData.js"
import { getChartMetadata } from "../helpers/PovertyProjectionsMetadata.js"
import { ResponsiveProjectionsLineChart } from "./ProjectionsLineChart.js"
import { ResponsiveProjectionsStackedAreaChart } from "./ProjectionsStackedAreaChart.js"
import { ProjectionsSpinner } from "./ProjectionsSpinner.js"

export function PovertyProjectionsCaptionedChart({
    variant,
    data,
    povertyLineCents,
    scenario,
    isLoading = false,
}: {
    variant: VariantName
    data: ProjectionsData
    povertyLineCents: number
    scenario: ScenarioSelection
    isLoading?: boolean
}) {
    const metadata = getChartMetadata({
        variant,
        povertyLineCents,
        scenario,
        firstProjectionYear: data.firstProjectionYear,
    })

    return (
        <Frame className="poverty-projections-captioned-chart">
            <ChartHeader
                className="poverty-projections-header"
                title={metadata.title}
                subtitle={metadata.subtitle}
            />
            <div className="poverty-projections-captioned-chart__chart-area">
                {isLoading && <ProjectionsSpinner />}
                {variant === "share" ? (
                    <ResponsiveProjectionsLineChart
                        data={data}
                        scenario={scenario}
                    />
                ) : (
                    <ResponsiveProjectionsStackedAreaChart
                        data={data}
                        scenario={
                            // The all-scenarios fan doesn't exist for the
                            // stacked chart; it is validated away upstream
                            scenario as ScenarioId | typeof BASELINE_SCENARIO
                        }
                    />
                )}
            </div>
            <ChartFooter
                className="poverty-projections-footer"
                source={metadata.source}
                note={metadata.note}
            />
        </Frame>
    )
}
