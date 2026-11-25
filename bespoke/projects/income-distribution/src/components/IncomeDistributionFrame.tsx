import { useCallback, useMemo, useState } from "react"
import cx from "clsx"
import * as R from "remeda"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { useBoxWithin } from "../../../../hooks/useBoxWithin.js"

import {
    INT_POVERTY_LINE,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import { chartNoteSegments } from "../core/chartText.js"
import { resolveFrameLayout } from "../core/frameLayout.js"
import type { IncomeDistributionMetadata } from "../core/data.js"
import { buildChartModel } from "../core/chartModel.js"
import {
    peopleBelowDisplayedLine,
    sharesBelowDisplayedLine,
} from "../core/density.js"
import { placeholderWelfareType } from "../core/welfareType.js"
import { welfareTypeSentence } from "../core/welfareSentence.js"
import type { ChartState } from "../core/useIncomeDistributionState.js"
import type { IncomeDistributionYear, LegendMeasure } from "../core/types.js"
import { CountryMultiSelect } from "./CountryMultiSelect.js"
import type {
    ChartPresentation,
    FrameEditCountriesMode,
    FrameLegendMode,
} from "../core/presentation.js"
import { IncomeDistributionChart } from "./IncomeDistributionChart.js"
import { WelfareSentence } from "./WelfareDetails.js"
import {
    IncomeDistributionLegend,
    LegendEntry,
} from "./IncomeDistributionLegend.js"

export interface IncomeDistributionFrameProps {
    metadata: IncomeDistributionMetadata
    yearData: IncomeDistributionYear
    /** What the chart draws */
    chartState: ChartState
    onSetPovertyLine: (line: number | null) => void
    onSelectedCountriesChange: (names: string[]) => void
    /** Whether the poverty line has a × (and the legend a way) to remove it */
    canClearPovertyLine: boolean
    isLoading: boolean
    isNarrow: boolean
    /** Above the plot: a ChartHeader, or a walkthrough's slide header */
    header: React.ReactNode
    /** Replaces the default footer (data source and note) */
    footer?: React.ReactNode
    legend?: FrameLegendMode
    editCountries?: FrameEditCountriesMode
    /** How the chart presents itself beyond the data; see ChartPresentation */
    presentation?: ChartPresentation
    /**
     * Over the plot's top-left corner, e.g. a sentence or a control. The
     * chart's labels keep clear of it.
     */
    plotOverlay?: React.ReactNode
    /** Anything else positioned absolutely over the chart area, unmeasured */
    chartAreaOverlay?: React.ReactNode
    className?: string
}

/**
 * The chart card: a Frame holding the header, the legend and "Edit
 * countries" where the chart's width puts them, the chart itself and the
 * footer. Every variant draws its chart with this; they differ in what they
 * put around and into it.
 */
export function IncomeDistributionFrame({
    metadata,
    yearData,
    chartState,
    onSetPovertyLine,
    onSelectedCountriesChange,
    canClearPovertyLine,
    isLoading,
    isNarrow,
    header,
    footer,
    legend = "auto",
    editCountries = "auto",
    presentation,
    plotOverlay,
    chartAreaOverlay,
    className,
}: IncomeDistributionFrameProps): React.ReactElement {
    const { view, selectedCountries, povertyLine, timeInterval, currency } =
        chartState

    const [hoveredEntity, setHoveredEntity] = useState<string | null>(null)
    // The countries the chart couldn't label directly, which the overlay
    // legend then lists; none until it says otherwise, so the legend doesn't
    // flash up on load
    const [unlabelledCountries, setUnlabelledCountries] = useState<string[]>([])

    // What floats over the plot, measured so the chart's labels keep clear
    const [chartArea, setChartArea] = useState<HTMLDivElement | null>(null)
    const [editCountriesNode, setEditCountriesNode] =
        useState<HTMLDivElement | null>(null)
    const [overlayLegendNode, setOverlayLegendNode] =
        useState<HTMLDivElement | null>(null)
    const [plotOverlayNode, setPlotOverlayNode] =
        useState<HTMLDivElement | null>(null)
    const editCountriesBox = useBoxWithin(chartArea, editCountriesNode)
    const overlayLegendBox = useBoxWithin(chartArea, overlayLegendNode)
    const plotOverlayBox = useBoxWithin(chartArea, plotOverlayNode)
    const chartObstacles = useMemo(() => {
        const boxes = [editCountriesBox, plotOverlayBox].filter(R.isDefined)
        return boxes.length > 0 ? boxes : undefined
    }, [editCountriesBox, plotOverlayBox])

    const year = yearData.year

    const model = useMemo(
        () =>
            buildChartModel({
                year: yearData,
                view,
                selectedCountries,
            }),
        [yearData, view, selectedCountries]
    )

    const legendEntries = useMemo<LegendEntry[]>(
        () =>
            povertyLine !== null
                ? [
                      ...model.legend,
                      { key: WORLD_ENTITY_NAME, color: WORLD_COLOR },
                  ]
                : model.legend,
        [model.legend, povertyLine]
    )

    // Shares and counts are taken against the amount the reader sees, not
    // the exact drag position (see sharesBelowDisplayedLine)
    const sharesBelowLine = useMemo(
        () =>
            povertyLine !== null
                ? sharesBelowDisplayedLine(
                      yearData,
                      povertyLine,
                      currency,
                      timeInterval,
                      legendEntries.map((entry) => entry.key)
                  )
                : undefined,
        [yearData, povertyLine, currency, timeInterval, legendEntries]
    )
    // With a line set, the legend's heading switches its bars between the
    // share of population below the line and the number of people. Only the
    // bars change, not the plot, so it isn't kept in the URL
    const [legendMeasure, setLegendMeasure] = useState<LegendMeasure>("share")
    const peopleBelowLine = useMemo(
        () =>
            povertyLine !== null && legendMeasure === "people"
                ? peopleBelowDisplayedLine(
                      yearData,
                      povertyLine,
                      currency,
                      timeInterval,
                      legendEntries.map((entry) => entry.key)
                  )
                : undefined,
        [
            yearData,
            povertyLine,
            currency,
            timeInterval,
            legendMeasure,
            legendEntries,
        ]
    )

    // Only the exact international line, as picked from the control, counts
    // as International; a line dragged or clicked to about $3 stays Custom
    const isInternationalPovertyLine = povertyLine === INT_POVERTY_LINE
    const clearPovertyLine = useCallback(
        () => onSetPovertyLine(null),
        [onSetPovertyLine]
    )

    const hasNoCountries = view === "countries" && model.series.length === 0
    const onClearPovertyLine = canClearPovertyLine
        ? clearPovertyLine
        : undefined

    // The swatch legend leaves the line out of the legend altogether
    const legendPovertyLine = legend === "swatches" ? null : povertyLine
    // The swatch legend lists the chart's own entries, without World
    const shownLegendEntries =
        legend === "swatches" ? model.legend : legendEntries
    const {
        showOverlayLegend,
        showInlineLegend,
        listsLeftovers,
        leftoverLegendTop,
        showEditCountries,
        showOverlayEditCountries,
        showLegendEditCountries,
        showToolbar,
    } = resolveFrameLayout({
        legend,
        editCountries,
        view,
        povertyLine,
        isNarrow,
        hasNoCountries,
        hasUnlabelled: unlabelledCountries.length > 0,
        editCountriesBottom: editCountriesBox?.bottom,
    })

    const editCountriesControl = (
        appearance: "button" | "link"
    ): React.ReactElement => (
        <CountryMultiSelect
            availableCountries={yearData.names}
            selectedCountries={selectedCountries}
            onChange={onSelectedCountriesChange}
            // TODO(feed welfare_type)
            welfareTypeOf={placeholderWelfareType}
            isNarrow={isNarrow}
            appearance={appearance}
        />
    )

    // Countries view: which of the countries drawn report income and which
    // consumption, in place of the note's general sentence on the two
    const welfareSentence =
        view === "countries"
            ? welfareTypeSentence(
                  model.series.map((series) => series.key),
                  placeholderWelfareType // TODO(feed welfare_type)
              )
            : undefined
    const noteSegments = chartNoteSegments(
        currency,
        year,
        isInternationalPovertyLine,
        welfareSentence
    )
    // A plain string unless a welfare term needs its details-on-demand span
    const note = noteSegments.every(
        (segment) => typeof segment === "string"
    ) ? (
        noteSegments.join("")
    ) : (
        <WelfareSentence segments={noteSegments} />
    )

    return (
        <BespokeMetadataProvider metadata={metadata.bespokeMetadata}>
            <Frame
                className={cx("income-distribution-captioned-chart", className)}
            >
                {header}
                {showToolbar && (
                    <div className="income-distribution-captioned-chart__toolbar">
                        {showInlineLegend && (
                            <IncomeDistributionLegend
                                entries={shownLegendEntries}
                                hoveredEntity={hoveredEntity}
                                onHoverEntity={setHoveredEntity}
                                sharesBelowLine={sharesBelowLine}
                                measure={legendMeasure}
                                onMeasureChange={setLegendMeasure}
                                peopleBelowLine={peopleBelowLine}
                                povertyLine={legendPovertyLine}
                                currency={currency}
                                timeInterval={timeInterval}
                                onClearPovertyLine={onClearPovertyLine}
                                isNarrow={isNarrow}
                            />
                        )}
                        {showEditCountries && (
                            <div className="income-distribution-captioned-chart__edit-countries">
                                {editCountriesControl("button")}
                            </div>
                        )}
                    </div>
                )}
                <div
                    ref={setChartArea}
                    className="income-distribution-captioned-chart__chart-area"
                >
                    {isLoading && <Spinner />}
                    {plotOverlay && (
                        <div
                            ref={setPlotOverlayNode}
                            className="income-distribution-captioned-chart__plot-overlay"
                        >
                            {plotOverlay}
                        </div>
                    )}
                    {(showOverlayEditCountries || showOverlayLegend) && (
                        <div
                            className={cx(
                                "income-distribution-captioned-chart__overlays",
                                {
                                    "income-distribution-captioned-chart__overlays--with-button":
                                        showOverlayEditCountries,
                                }
                            )}
                        >
                            {showOverlayEditCountries && (
                                <div ref={setEditCountriesNode}>
                                    {editCountriesControl("button")}
                                </div>
                            )}
                            {showOverlayLegend && (
                                <div ref={setOverlayLegendNode}>
                                    <IncomeDistributionLegend
                                        layout="overlay"
                                        entries={shownLegendEntries}
                                        hoveredEntity={hoveredEntity}
                                        onHoverEntity={setHoveredEntity}
                                        sharesBelowLine={sharesBelowLine}
                                        measure={legendMeasure}
                                        onMeasureChange={setLegendMeasure}
                                        peopleBelowLine={peopleBelowLine}
                                        povertyLine={legendPovertyLine}
                                        currency={currency}
                                        timeInterval={timeInterval}
                                        onClearPovertyLine={onClearPovertyLine}
                                        footer={
                                            showLegendEditCountries
                                                ? editCountriesControl("link")
                                                : undefined
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {hasNoCountries ? (
                        <div className="income-distribution__no-data">
                            {editCountries === "hidden"
                                ? "No data for the selected countries."
                                : "Use “Edit countries” to pick a country and see its income distribution."}
                        </div>
                    ) : (
                        <IncomeDistributionChart
                            model={model}
                            yearData={yearData}
                            year={year}
                            currency={currency}
                            timeInterval={timeInterval}
                            povertyLine={povertyLine}
                            isInternationalPovertyLine={
                                isInternationalPovertyLine
                            }
                            onSetPovertyLine={onSetPovertyLine}
                            onClearPovertyLine={onClearPovertyLine}
                            hoveredEntity={hoveredEntity}
                            onHoverEntity={setHoveredEntity}
                            isNarrow={isNarrow}
                            obstacles={chartObstacles}
                            legendBox={
                                listsLeftovers ? undefined : overlayLegendBox
                            }
                            leftoverLegendTop={leftoverLegendTop}
                            onUnlabelledCountriesChange={setUnlabelledCountries}
                            {...presentation}
                        />
                    )}
                    {chartAreaOverlay}
                </div>
                {footer ?? <ChartFooter source={metadata.source} note={note} />}
            </Frame>
        </BespokeMetadataProvider>
    )
}
