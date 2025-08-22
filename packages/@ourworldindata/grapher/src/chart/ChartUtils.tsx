import * as React from "react"
import {
    Box,
    excludeUndefined,
    getCountryByName,
    Url,
} from "@ourworldindata/utils"
import {
    SeriesStrategy,
    EntityName,
    InteractionState,
    SeriesName,
    ColumnSlug,
    GrapherTabName,
    GRAPHER_TAB_NAMES,
    ProjectionColumnInfo,
    CoreValueType,
    PrimitiveType,
    ColumnTypeNames,
    Time,
} from "@ourworldindata/types"
import { LineChartSeries } from "../lineCharts/LineChartConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartManager } from "./ChartManager"
import {
    GRAPHER_SIDE_PANEL_CLASS,
    GRAPHER_TIMELINE_CLASS,
    GRAPHER_SETTINGS_CLASS,
    SVG_STYLE_PROPS,
    BASE_FONT_SIZE,
    Patterns,
} from "../core/GrapherConstants"
import { ChartSeries } from "./ChartInterface"
import {
    ErrorValueTypes,
    isNotErrorValueOrEmptyCell,
    OwidTable,
} from "@ourworldindata/core-table"
import { GRAPHER_BACKGROUND_DEFAULT } from "../color/ColorConstants"

export const autoDetectYColumnSlugs = (manager: ChartManager): string[] => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
}

export const getDefaultFailMessage = (manager: ChartManager): string => {
    if (manager.table.rootTable.isBlank) return `No table loaded yet`
    if (manager.table.rootTable.entityNameColumn.isMissing)
        return `Table is missing an EntityName column`
    if (manager.table.rootTable.timeColumn.isMissing)
        return `Table is missing a Time column`
    const yColumnSlugs = autoDetectYColumnSlugs(manager)
    if (!yColumnSlugs.length) return "Missing Y axis column"
    const selection = makeSelectionArray(manager.selection)
    if (!selection.hasSelection) return `No ${manager.entityType} selected`
    return ""
}

export const getSeriesKey = (
    series: LineChartSeries,
    index: number
): string => {
    return `${series.seriesName}-${series.color}-${
        series.isProjection ? "projection" : ""
    }-${index}`
}

export const autoDetectSeriesStrategy = (
    manager: ChartManager,
    handleProjections: boolean = false
): SeriesStrategy => {
    if (manager.seriesStrategy) return manager.seriesStrategy

    let columnThreshold: number = 1

    if (handleProjections && manager.transformedTable) {
        const yColumnSlugs = autoDetectYColumnSlugs(manager)
        const yColumns = yColumnSlugs.map((slug) =>
            manager.transformedTable!.get(slug)
        )
        const hasNormalAndProjectedSeries =
            yColumns.some((col) => col.isProjection) &&
            yColumns.some((col) => !col.isProjection)
        if (hasNormalAndProjectedSeries) {
            columnThreshold = 2
        }
    }

    return autoDetectYColumnSlugs(manager).length > columnThreshold
        ? SeriesStrategy.column
        : SeriesStrategy.entity
}

export interface ClipPath {
    id: string
    element: React.ReactElement
}

export const makeClipPath = (props: {
    name?: string
    renderUid: number
    box: Box
}): {
    id: string
    element: React.ReactElement
} => {
    const name = props.name ?? "boundsClip"
    const id = `${name}-${props.renderUid}`
    return {
        id: `url(#${id})`,
        element: (
            <defs>
                <clipPath id={id}>
                    <rect {...props.box}></rect>
                </clipPath>
            </defs>
        ),
    }
}

export const makeSelectionArray = (
    selection?: SelectionArray | EntityName[]
): SelectionArray =>
    selection instanceof SelectionArray
        ? selection
        : new SelectionArray(selection ?? [])

export function isElementInteractive(element: HTMLElement): boolean {
    const interactiveTags = ["a", "button", "input"]
    const interactiveClassNames = [
        GRAPHER_TIMELINE_CLASS,
        GRAPHER_SIDE_PANEL_CLASS,
        GRAPHER_SETTINGS_CLASS,
    ].map((className) => `.${className}`)

    const selector = [...interactiveTags, ...interactiveClassNames].join(", ")

    // check if the target is an interactive element or contained within one
    return element.closest(selector) !== null
}

export function getShortNameForEntity(entityName: string): string | undefined {
    const country = getCountryByName(entityName)
    return country?.shortName
}

export function isTargetOutsideElement(
    target: EventTarget,
    element: Node
): boolean {
    const targetNode = target as Node
    return (
        !element.contains(targetNode) &&
        // check that the target is still mounted to the document (we also get
        // click events on nodes that have since been removed by React)
        document.contains(targetNode)
    )
}

export function getHoverStateForSeries(
    series: ChartSeries,
    props: {
        hoveredSeriesNames: SeriesName[]
        // usually the hover mode is active when there is
        // at least one hovered element. But sometimes the hover
        // mode might be active although there are no hovered elements.
        // For example, when the facet legend is hovered but a particular
        // chart doesn't plot the hovered element.
        isHoverModeActive?: boolean
    }
): InteractionState {
    const hoveredSeriesNames = props.hoveredSeriesNames
    const isHoverModeActive =
        props.isHoverModeActive ?? hoveredSeriesNames.length > 0

    const active = hoveredSeriesNames.includes(series.seriesName)
    const foreground = !isHoverModeActive || active
    const background = isHoverModeActive && !active
    return { idle: !isHoverModeActive, active, foreground, background }
}

/** Useful for sorting series by their interaction state */
export function byHoverThenFocusState(series: {
    hover: InteractionState
    focus: InteractionState
}): number {
    // active series rank highest and hover trumps focus
    if (series.hover.active) return 4
    if (series.focus.active) return 3

    // series in their default state rank in the middle
    if (!series.hover.background && !series.focus.background) return 2

    // background series rank lowest
    return 1
}

export function makeAxisLabel({
    label,
    unit,
    shortUnit,
}: {
    label: string
    unit?: string
    shortUnit?: string
}): {
    mainLabel: string // shown in bold
    unit?: string // shown in normal weight, usually in parens
} {
    const displayUnit = unit && unit !== shortUnit ? unit : undefined

    if (displayUnit) {
        // extract text in parens at the end of the label,
        // e.g. "Population (millions)" is split into "Population " and "(millions)"
        const [
            _fullMatch,
            untrimmedMainLabelText = undefined,
            labelTextInParens = undefined,
        ] = label.trim().match(/^(.*?)(\([^()]*\))?$/s) ?? []
        const mainLabelText = untrimmedMainLabelText?.trim() ?? ""

        // don't show unit twice if it's contained in the label
        const displayLabel =
            labelTextInParens === `(${displayUnit})` ? mainLabelText : label

        return { mainLabel: displayLabel, unit: displayUnit }
    }

    return { mainLabel: label }
}

/**
 * Given a URL for a CF function grapher thumbnail, generate a srcSet for the image at different widths
 * @param defaultSrc - `https://ourworldindata.org/grapher/thumbnail/life-expectancy.png?tab=chart`
 * @returns srcSet - `https://ourworldindata.org/grapher/thumbnail/life-expectancy.png?tab=chart&imWidth=850 850w, https://ourworldindata.org/grapher/thumbnail/life-expectancy.png?tab=chart&imWidth=1700 1700w`
 */
export function generateGrapherImageSrcSet(defaultSrc: string): string {
    const url = Url.fromURL(defaultSrc)
    const existingQueryParams = url.queryParams
    const imWidths = ["850", "1700"]
    const srcSet = imWidths
        .map((imWidth) => {
            return `${url.setQueryParams({ ...existingQueryParams, imWidth }).fullUrl} ${imWidth}w`
        })
        .join(", ")

    return srcSet
}

export const isChartTab = (tab: GrapherTabName): boolean =>
    tab !== GRAPHER_TAB_NAMES.Table && tab !== GRAPHER_TAB_NAMES.WorldMap

export const isMapTab = (tab: GrapherTabName): boolean =>
    tab === GRAPHER_TAB_NAMES.WorldMap

export function combineHistoricalAndProjectionColumns(
    table: OwidTable,
    info: ProjectionColumnInfo,
    options?: { shouldAddIsProjectionColumn: boolean }
): OwidTable {
    const {
        historicalSlug,
        projectedSlug,
        combinedSlug,
        slugForIsProjectionColumn,
    } = info

    const transformFn = (
        row: Record<ColumnSlug, { value: CoreValueType; time: Time }>,
        time: Time
    ): { isProjection: boolean; value: PrimitiveType } | undefined => {
        // It's possible to have both a historical and a projected value
        // for a given year. In that case, we prefer the historical value.

        const historical = row[historicalSlug]
        const projected = row[projectedSlug]

        const historicalTimeDiff = Math.abs(historical.time - time)
        const projectionTimeDiff = Math.abs(projected.time - time)

        if (
            isNotErrorValueOrEmptyCell(historical.value) &&
            // If tolerance was applied to the historical column, we need to
            // make sure the interpolated historical value doesn't get picked
            // over the actual projected value
            historicalTimeDiff <= projectionTimeDiff
        )
            return { value: historical.value, isProjection: false }

        if (isNotErrorValueOrEmptyCell(projected.value)) {
            return { value: projected.value, isProjection: true }
        }

        return undefined
    }

    // Combine the historical and projected values into a single column
    table = table.combineColumns(
        [projectedSlug, historicalSlug],
        { ...table.get(projectedSlug).def, slug: combinedSlug },
        (row, time) =>
            transformFn(row, time)?.value ??
            ErrorValueTypes.MissingValuePlaceholder
    )

    // Add a column indicating whether the value is a projection or not
    if (options?.shouldAddIsProjectionColumn)
        table = table.combineColumns(
            [projectedSlug, historicalSlug],
            {
                slug: slugForIsProjectionColumn,
                type: ColumnTypeNames.Boolean,
            },
            (row, time) =>
                transformFn(row, time)?.isProjection ??
                ErrorValueTypes.MissingValuePlaceholder
        )

    return table
}

export function NoDataPattern({
    patternId = Patterns.noDataPattern,
    scale = 1,
}: {
    patternId?: string
    scale?: number
}): React.ReactElement {
    const patternTransforms = excludeUndefined([
        `rotate(-45 2 2)`,
        scale !== 1 ? `scale(${scale})` : undefined,
    ])
    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform={patternTransforms.join(" ")}
        >
            <path d="M -1,2 l 6,0" stroke="#ccc" strokeWidth={0.7} />
        </pattern>
    )
}

export function getChartSvgProps({
    fontSize,
    backgroundColor,
}: {
    fontSize?: number
    backgroundColor?: string
}): React.SVGProps<SVGSVGElement> {
    return {
        xmlns: "http://www.w3.org/2000/svg",
        version: "1.1",
        style: {
            ...SVG_STYLE_PROPS,
            fontSize: fontSize ?? BASE_FONT_SIZE,
            // Needs to be set here or else pngs will have a black background
            backgroundColor: backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT,
        },
    }
}
