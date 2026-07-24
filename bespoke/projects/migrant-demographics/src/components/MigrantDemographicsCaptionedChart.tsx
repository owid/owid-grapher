import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"

import {
    MetricMode,
    NATIVE_BORN_COLOR,
    PyramidData,
} from "../helpers/constants.js"
import {
    formatCountWords,
    formatEntityForSentence,
    formatEntityForTitle,
} from "../helpers/format.js"
import { PopulationPyramid } from "./PopulationPyramid.js"

export function MigrantDemographicsCaptionedChart({
    data,
    source,
    note,
    metric,
    compare,
    isLoading = false,
}: {
    data: PyramidData
    source: string
    note?: string
    metric: MetricMode
    compare: boolean
    isLoading?: boolean
}): React.ReactElement {
    const entitySentence = formatEntityForSentence(data.entityName)
    const entityTitle = formatEntityForTitle(data.entityName)

    return (
        <Frame className="migrant-demographics-captioned-chart">
            <ChartHeader
                className="migrant-demographics-header"
                title={`Population pyramid of immigrants living in ${entityTitle}`}
                subtitle={
                    <>
                        The age and sex profile of the{" "}
                        {formatCountWords(data.totalMigrants)} living in{" "}
                        {entitySentence} who were born elsewhere.
                    </>
                }
            />

            {compare && <NativeBornLegend />}

            <div className="migrant-demographics-captioned-chart__chart-area">
                {isLoading && <Spinner />}
                <PopulationPyramid
                    data={data}
                    metric={metric}
                    compare={compare}
                />
            </div>

            <ChartFooter
                className="migrant-demographics-footer"
                source={source}
                note={note}
            />
        </Frame>
    )
}

function NativeBornLegend(): React.ReactElement {
    return (
        <div className="migrant-demographics-legend">
            <span
                className="migrant-demographics-legend__swatch"
                style={{ backgroundColor: NATIVE_BORN_COLOR }}
                aria-hidden
            />
            <span className="migrant-demographics-legend__label">
                Native-born residents
            </span>
        </div>
    )
}
