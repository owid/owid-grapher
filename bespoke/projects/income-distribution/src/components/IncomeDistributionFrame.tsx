import { useCallback, useEffect, useMemo, useState } from "react"
import cx from "clsx"
import * as R from "remeda"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"

import {
    FIRST_NOWCAST_YEAR,
    INT_POVERTY_LINE,
    INTERNATIONAL_DOLLAR,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import type { IncomeDistributionMetadata } from "../core/data.js"
import { buildChartModel } from "../core/chartModel.js"
import type { LabelBox } from "../core/curveLabels.js"
import {
    peopleBelowDisplayedLine,
    sharesBelowDisplayedLine,
} from "../core/density.js"
import { placeholderWelfareType } from "../core/welfareType.js"
import {
    welfareTypeSentence,
    type WelfareSentenceSegment,
} from "../core/welfareSentence.js"
import type { ChartState } from "../core/useIncomeDistributionState.js"
import type {
    Currency,
    IncomeDistributionYear,
    LegendMeasure,
} from "../core/types.js"
import { CountryMultiSelect } from "./CountryMultiSelect.js"
import {
    IncomeDistributionChart,
    type IncomeDistributionChartEmphasis,
} from "./IncomeDistributionChart.js"
import { WelfareSentence } from "./WelfareDetails.js"
import {
    IncomeDistributionLegend,
    LegendEntry,
} from "./IncomeDistributionLegend.js"

/** Top of the overlays over the plot without the button, and the gap between them (.income-distribution-captioned-chart__overlays in IncomeDistributionFrame.scss) */
const OVERLAY_TOP = 38
const OVERLAY_GAP = 8

/**
 * Which legend the frame shows. `auto` is the chart's own: the region or
 * country swatches, turning into the share bars once a poverty line is set.
 * `swatches` keeps the swatches whatever the line; `hidden` shows none.
 */
export type FrameLegendMode = "auto" | "swatches" | "hidden"

/**
 * Where the countries view's "Edit countries" goes: `auto` is a button over
 * the plot's corner (in the row above the plot on narrow charts), `legend`
 * a link at the bottom of the overlay legend, `hidden` nowhere
 */
export type FrameEditCountriesMode = "auto" | "legend" | "hidden"

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
    /** How the chart emphasises parts of itself; see IncomeDistributionChart */
    emphasis?: IncomeDistributionChartEmphasis
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
    emphasis,
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
    const availableCountries = useMemo(
        () => yearData.countries.map((country) => country.name),
        [yearData]
    )

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
    const showEditCountries = view === "countries" && editCountries !== "hidden"
    // On wide charts the legend floats over the plot's top-right corner and
    // turns into the share bars when a poverty line is set, so setting a line
    // never pushes the plot down; narrow charts keep it above the plot, where
    // it doesn't cover the mountains. In the countries view the curves are
    // labelled directly, so without a line the overlay legend only shows when
    // some country couldn't be labelled.
    const showOverlayLegend =
        !isNarrow &&
        !hasNoCountries &&
        legend !== "hidden" &&
        (legend === "swatches" ||
            view === "global" ||
            povertyLine !== null ||
            unlabelledCountries.length > 0)
    // Countries view without a line: the overlay legend only appears when a
    // country couldn't be labelled, and then lists every country
    const listsLeftovers =
        legend === "auto" &&
        view === "countries" &&
        povertyLine === null &&
        !isNarrow
    // The swatch legend lists the chart's own entries, without World
    const shownLegendEntries =
        legend === "swatches" ? model.legend : legendEntries
    // Where that legend starts: below the button, else below the poverty
    // line's label (see .income-distribution-captioned-chart__overlays)
    const leftoverLegendTop = listsLeftovers
        ? editCountriesBox
            ? editCountriesBox.bottom + OVERLAY_GAP
            : OVERLAY_TOP
        : undefined
    const showInlineLegend = isNarrow && !hasNoCountries && legend !== "hidden"
    // Wide charts put the button over the plot's top-right corner, above the
    // overlay legend; narrow ones keep it in the row above the plot. In the
    // legend, it's a link at the legend's foot
    const showLegendEditCountries =
        showEditCountries && !isNarrow && editCountries === "legend"
    const showOverlayEditCountries =
        showEditCountries && !isNarrow && editCountries === "auto"
    const showToolbar = isNarrow && (showInlineLegend || showEditCountries)

    const editCountriesControl = (
        appearance: "button" | "link"
    ): React.ReactElement => (
        <CountryMultiSelect
            availableCountries={availableCountries}
            selectedCountries={selectedCountries}
            onChange={onSelectedCountriesChange}
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
                  placeholderWelfareType
              )
            : undefined

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
                            {...emphasis}
                        />
                    )}
                    {chartAreaOverlay}
                </div>
                {footer ?? (
                    <ChartFooter
                        source={metadata.source}
                        note={chartNote(
                            currency,
                            year,
                            isInternationalPovertyLine,
                            welfareSentence
                        )}
                    />
                )}
            </Frame>
        </BespokeMetadataProvider>
    )
}

/**
 * Where `element` sits within `container` (both laid out), kept up to date as
 * either resizes; undefined while either is missing
 */
function useBoxWithin(
    container: HTMLElement | null,
    element: HTMLElement | null
): LabelBox | undefined {
    const [box, setBox] = useState<LabelBox | undefined>(undefined)

    useEffect(() => {
        if (!container || !element || typeof ResizeObserver === "undefined")
            return
        const update = (): void => {
            const outer = container.getBoundingClientRect()
            const inner = element.getBoundingClientRect()
            const next: LabelBox = {
                left: inner.left - outer.left,
                right: inner.right - outer.left,
                top: inner.top - outer.top,
                bottom: inner.bottom - outer.top,
            }
            // Keep the old object when nothing moved, so the chart's label
            // layout isn't redone
            setBox((prev) => (prev && R.isDeepEqual(prev, next) ? prev : next))
        }
        // Also reports both elements' sizes once when they're observed
        const observer = new ResizeObserver(update)
        observer.observe(container)
        observer.observe(element)
        return () => observer.disconnect()
    }, [container, element])

    return container && element ? box : undefined
}

function chartNote(
    currency: Currency,
    year: number,
    isInternationalLine: boolean,
    /** Countries view: which of the countries shown report which (welfareTypeSentence) */
    welfareSentence?: WelfareSentenceSegment[]
): React.ReactNode {
    // The countries' own sentence says what each reports, so it replaces
    // the general one
    const sentences = welfareSentence
        ? []
        : [
              "Depending on the country, the data relates to income measured after taxes and benefits, or to consumption, per capita.",
          ]
    // Below the plot rather than in the subtitle, so picking or dragging the
    // line never reflows the chart above it
    if (isInternationalLine)
        sentences.push(
            "The International Poverty Line is set by the World Bank as its definition of extreme poverty."
        )
    if (year >= FIRST_NOWCAST_YEAR)
        sentences.push(
            `Figures for ${year} are World Bank nowcasts, which extrapolate the latest household surveys using economic growth.`
        )
    if (currency.code !== INTERNATIONAL_DOLLAR.code)
        sentences.push(
            `Incomes in local currencies are converted from international-$ using PPP conversion factors and adjusted for inflation to ${currency.pricesYear ? `${currency.pricesYear} prices` : "the latest year available"}.`
        )
    if (!welfareSentence) return sentences.join(" ")
    return (
        <>
            <WelfareSentence segments={welfareSentence} />
            {sentences.map((sentence) => ` ${sentence}`).join("")}
        </>
    )
}
