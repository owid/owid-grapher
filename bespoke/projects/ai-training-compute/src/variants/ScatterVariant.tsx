import { useMemo, useState } from "react"
import * as R from "remeda"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsStringEnum } from "nuqs"

import type { BespokeVariantProps } from "owid-bespoke-types"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"

import { ColorByDropdown } from "../components/ColorByDropdown.js"
import { ComputeChart } from "../components/ComputeChart.js"
import { Legend } from "../components/Legend.js"
import { TimeRangeSlider } from "../components/TimeRangeSlider.js"
import { YScaleSwitch } from "../components/YScaleSwitch.js"
import {
    AiModel,
    COLOR_BY_OPTIONS,
    ColorBy,
    Y_SCALE_TYPES,
} from "../core/constants.js"
import { COLOR_SCHEMES } from "../core/colorSchemes.js"
import { ChartData, queryClient, useChartData } from "../core/data.js"
import { DEFAULT_SUBTITLES } from "../core/text.js"
import {
    getInitialYearRange,
    getTimeDomain,
    getYearExtent,
} from "../core/timeDomain.js"
import type { AiTrainingComputeConfig } from "../index.js"

export function ScatterVariant({
    config,
    urls,
}: BespokeVariantProps<AiTrainingComputeConfig>): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <FetchingScatterVariant config={config} apiUrl={urls.dataUrl} />
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function FetchingScatterVariant({
    config,
    apiUrl,
}: {
    config: AiTrainingComputeConfig
    apiUrl: string
}): React.ReactElement {
    const { data, status } = useChartData(apiUrl)
    if (status === "pending")
        return <ChartSkeleton className="ai-training-compute-box" />
    if (status === "error" || !data)
        return <ChartError className="ai-training-compute-box" />
    return <CaptionedScatterVariant config={config} data={data} />
}

function CaptionedScatterVariant({
    config,
    data,
}: {
    config: AiTrainingComputeConfig
    data: ChartData
}): React.ReactElement {
    // Shared in the URL on pages that sync it, such as featured viz pages
    const [colorBy, setColorBy] = useUrlState({
        key: "color",
        parser: parseAsStringEnum([...COLOR_BY_OPTIONS]),
        defaultValue: config.colorBy,
    })
    const [yScaleType, setYScaleType] = useUrlState({
        key: "yScale",
        parser: parseAsStringEnum([...Y_SCALE_TYPES]),
        defaultValue: config.yScale,
    })
    // A focused legend group belongs to one color
    const [focus, setFocus] = useState<{ colorBy: ColorBy; group: string }>()
    const focusedGroup = focus?.colorBy === colorBy ? focus.group : undefined

    const labeledModels = useMemo(
        () =>
            config.labeledModels
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean),
        [config.labeledModels]
    )
    // The timeline runs over the data's years; the configured start and
    // end years only set where it starts
    const yearExtent = useMemo(() => getYearExtent(data.models), [data.models])
    const initialRange = getInitialYearRange(yearExtent, {
        startYear: config.startYear,
        endYear: config.endYear,
    })
    const [startYear, setStartYear] = useUrlState({
        key: "start",
        parser: parseAsInteger,
        defaultValue: initialRange[0],
    })
    const [endYear, setEndYear] = useUrlState({
        key: "end",
        parser: parseAsInteger,
        defaultValue: initialRange[1],
    })
    const yearRange = getInitialYearRange(yearExtent, { startYear, endYear })
    const xDomain = useMemo(
        () => getTimeDomain(yearRange),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [yearRange[0], yearRange[1]]
    )
    const counts = useMemo(
        () => countGroups(data.models, colorBy, xDomain),
        [data.models, colorBy, xDomain]
    )

    const showControls = !config.hideColorBy || !config.hideYScaleToggle

    return (
        <BespokeMetadataProvider metadata={data.metadata}>
            <Frame className="ai-training-compute">
                <ChartHeader
                    title={config.title}
                    subtitle={config.subtitle ?? DEFAULT_SUBTITLES[colorBy]}
                />
                {showControls && (
                    <div className="ai-training-compute__controls">
                        {!config.hideColorBy && (
                            <ColorByDropdown
                                colorBy={colorBy}
                                onChange={setColorBy}
                            />
                        )}
                        {!config.hideYScaleToggle && (
                            <YScaleSwitch
                                yScaleType={yScaleType}
                                onChange={setYScaleType}
                            />
                        )}
                    </div>
                )}
                <Legend
                    colorBy={colorBy}
                    counts={counts}
                    focusedGroup={focusedGroup}
                    onFocusChange={(group) =>
                        setFocus(group ? { colorBy, group } : undefined)
                    }
                />
                <div className="ai-training-compute__chart-area">
                    <ResponsiveContainer>
                        {({ width, height }) => (
                            <ComputeChart
                                width={width}
                                height={height}
                                models={data.models}
                                colorBy={colorBy}
                                yScaleType={yScaleType}
                                xDomain={xDomain}
                                yBounds={{
                                    min: config.yAxisMin,
                                    max: config.yAxisMax,
                                }}
                                showUncertainty={config.showUncertainty}
                                labeledModels={labeledModels}
                                focusedGroup={focusedGroup}
                            />
                        )}
                    </ResponsiveContainer>
                </div>
                {!config.hideTimeline && (
                    <TimeRangeSlider
                        min={yearExtent[0]}
                        max={yearExtent[1]}
                        range={yearRange}
                        onChange={([start, end]) => {
                            setStartYear(start)
                            setEndYear(end)
                        }}
                    />
                )}
                <ChartFooter note={config.note} />
            </Frame>
        </BespokeMetadataProvider>
    )
}

/** Models per color group within the time axis, for the legend */
function countGroups(
    models: AiModel[],
    colorBy: ColorBy,
    [start, end]: [number, number]
): ReadonlyMap<string, number> {
    const groupOf = COLOR_SCHEMES[colorBy].groupOf
    const inView = models.filter((m) => m.year >= start && m.year <= end)
    return new Map(
        Object.entries(
            R.countBy(
                inView.filter((m) => groupOf(m)),
                (m) => groupOf(m) ?? ""
            )
        )
    )
}
