import * as R from "remeda"
import { useParentSize } from "@visx/responsive"
import { Group } from "@visx/group"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import {
    MarkdownTextWrap,
    MarkdownTextWrapSvg,
    TextWrap,
    TextWrapSvg,
    shortenWithEllipsis,
} from "@ourworldindata/components"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow.js"
import {
    formatPopulationValueLong,
    formatPopulationValueShort,
} from "../helpers/utils.js"
import type { Simulation } from "../helpers/useSimulation.js"
import type { ProjectionType } from "./PopulationPyramid.js"
import {
    AGE_ZONE_BACKGROUND_OPACITY,
    COLOR_CHILDREN,
    COLOR_RETIRED,
    COLOR_WORKING,
} from "../helpers/constants.js"
import { Bounds, formatValue } from "@ourworldindata/utils"
import { toBreakpoint } from "../helpers/useBreakpoint.js"
import { getAgeZoneLegendFonts } from "../helpers/fonts.js"

const BAR_PADDING_Y = 4
const SEGMENT_GAP = 2
const BOX_PADDING_Y = 5
const BOX_PADDING_LEFT = 5
const BOX_PADDING_RIGHT = 2
const LABEL_VALUE_GAP = 2
const OVERFLOW_ANNOTATION_LINE_LENGTH = 6
const OVERFLOW_ANNOTATION_BOX_ARROW_GAP = 4
const OVERFLOW_ANNOTATION_LINE_TEXT_GAP = 2

interface AgeZoneLegendProps {
    simulation: Simulation
    year: number
    projection?: ProjectionType
}

interface RawZone {
    key: string
    labelLong: string
    labelShort: string
    population: number
    color: string
}

interface PlacedZone extends RawZone {
    fraction: number
    startX: number
    width: number
}

interface AnnotatedZone extends PlacedZone {
    labelWrap?: TextWrap
    valueWrap?: TextWrap
    overflowAnnotation?: { label: string; value: string }
}

function AgeZoneLegendContent({
    simulation,
    year,
    projection = "custom",
    width,
}: AgeZoneLegendProps & { width: number }) {
    const populationByAgeZone = (
        projection === "un"
            ? simulation.getBenchmarkAgeZonePopulation
            : simulation.getAgeZonePopulation
    )(year)
    const fonts = getAgeZoneLegendFonts(toBreakpoint(width))

    const total =
        populationByAgeZone.young +
        populationByAgeZone.working +
        populationByAgeZone.old
    if (total === 0 || width <= 0) return null

    // Define zone descriptors, ordered: working first, then larger dependent, then smaller
    const youngZone = {
        key: "young",
        labelLong: "Children (<15)",
        labelShort: "Children",
        population: populationByAgeZone.young,
        color: COLOR_CHILDREN,
    }
    const oldZone = {
        key: "old",
        labelLong: "Retired (65+)",
        labelShort: "Retired",
        population: populationByAgeZone.old,
        color: COLOR_RETIRED,
    }
    const placedZones = [
        {
            key: "working",
            labelLong: "Working population (15–64 years)",
            labelShort: "Working population",
            population: populationByAgeZone.working,
            color: COLOR_WORKING,
        },
        youngZone,
        oldZone,
    ]

    const renderZones = annotateZones(
        placeZones(placedZones, width, SEGMENT_GAP),
        fonts.ageZoneLabel,
        fonts.valueLabel
    )

    const barHeight = fonts.percentageLabel + 2 * BAR_PADDING_Y
    const totalPopulationLabelHeight = fonts.totalPopulationLabel

    const barY = totalPopulationLabelHeight + 0.85 * fonts.totalPopulationLabel
    const annotationY = barY + barHeight

    // Use the tallest annotation to size the bracket
    const maximumLabelHeight = Math.max(
        0,
        ...renderZones.map((z) => {
            if (!z.labelWrap) return 0
            return z.valueWrap
                ? z.labelWrap.height + LABEL_VALUE_GAP + z.valueWrap.height
                : z.labelWrap.height
        })
    )
    const boxHeight = maximumLabelHeight + 2 * BOX_PADDING_Y

    // Overflow annotation (there can only be one)
    const overflowZone = renderZones.find((zone) => zone.overflowAnnotation)
    const overflowHeight = overflowZone
        ? OVERFLOW_ANNOTATION_BOX_ARROW_GAP +
          OVERFLOW_ANNOTATION_LINE_LENGTH +
          OVERFLOW_ANNOTATION_LINE_TEXT_GAP +
          fonts.ageZoneLabel +
          LABEL_VALUE_GAP +
          fonts.valueLabel
        : 0
    const overflowY = annotationY + boxHeight

    const height = annotationY + boxHeight + overflowHeight

    const bounds = new Bounds(0, 0, width, height)

    return (
        <svg width={bounds.width} height={bounds.height} overflow="visible">
            <TotalPopulationLabel
                total={total}
                width={bounds.width}
                fontSize={fonts.totalPopulationLabel}
            />

            {/* Stacked bar segments */}
            <Group top={barY}>
                <BarSegments
                    zones={renderZones}
                    fontSize={fonts.percentageLabel}
                    barHeight={barHeight}
                />
            </Group>

            {/* Annotations below bar */}
            <Group top={annotationY}>
                {renderZones.map((zone) => (
                    <AgeZoneLegendBox
                        key={zone.key}
                        zone={zone}
                        height={boxHeight}
                    />
                ))}
            </Group>

            {overflowZone && (
                <OverflowAnnotation
                    zone={overflowZone}
                    top={overflowY}
                    labelFontSize={fonts.ageZoneLabel}
                    valueFontSize={fonts.valueLabel}
                />
            )}
        </svg>
    )
}

function BarSegments({
    zones,
    fontSize,
    barHeight,
}: {
    zones: AnnotatedZone[]
    fontSize: number
    barHeight: number
}) {
    return (
        <g>
            {zones.map((zone) => {
                const percentageLabel = formatValue(zone.fraction * 100, {
                    unit: "%",
                    numDecimalPlaces: 0,
                })
                const textWrap = new TextWrap({
                    text: percentageLabel,
                    maxWidth: Infinity,
                    fontSize,
                    fontWeight: 500,
                })
                const horizontalPadding = 2

                const shouldShowLabel =
                    textWrap.width + horizontalPadding * 2 <= zone.width

                return (
                    <g key={zone.key}>
                        <rect
                            x={zone.startX}
                            width={zone.width}
                            height={barHeight}
                            fill={zone.color}
                        />
                        {shouldShowLabel && (
                            <text
                                x={zone.startX + zone.width / 2}
                                y={barHeight / 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={fontSize}
                                fontWeight={500}
                                fill="white"
                            >
                                {percentageLabel}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

function TotalPopulationLabel({
    total,
    width,
    fontSize,
}: {
    total: number
    width: number
    fontSize: number
}) {
    const label = `**Total population:** ${formatPopulationValueLong(total)}`
    const textWrap = new MarkdownTextWrap({
        text: label,
        maxWidth: width,
        fontSize,
        lineHeight: 1,
    })

    const baseY = fontSize / 2
    const horizontalPadding = 6

    const x = (width - textWrap.width) / 2
    const y = baseY - textWrap.height / 2

    return (
        <>
            <BezierArrow
                start={[0, baseY]}
                end={[width, baseY]}
                color={GRAPHER_LIGHT_TEXT}
                headAnchor="both"
                headLength={5}
            />
            <rect
                x={x - horizontalPadding}
                y={y}
                width={textWrap.width + horizontalPadding * 2}
                height={textWrap.height}
                fill="white"
            />
            <MarkdownTextWrapSvg
                textWrap={textWrap}
                x={x}
                y={y}
                fill={GRAPHER_DARK_TEXT}
            />
        </>
    )
}

function AgeZoneLegendBox({
    zone,
    height,
}: {
    zone: AnnotatedZone
    height: number
}) {
    const left = zone.startX
    const right = zone.startX + zone.width

    const textX = left + BOX_PADDING_LEFT
    const labelY = BOX_PADDING_Y
    const valueY = zone.labelWrap
        ? labelY + zone.labelWrap.height + LABEL_VALUE_GAP
        : labelY

    return (
        <>
            {/* Background fill */}
            <rect
                x={left}
                y={0}
                width={right - left}
                height={height}
                fill={zone.color}
                opacity={AGE_ZONE_BACKGROUND_OPACITY}
            />
            {/*
            <line
                x1={left}
                y1={0}
                x2={left}
                y2={height}
                stroke={zone.color}
                strokeWidth={strokeWidth}
            />
            <line
                x1={right}
                y1={0}
                x2={right}
                y2={height}
                stroke={zone.color}
                strokeWidth={strokeWidth}
            />
            <line
                x1={left - strokeWidth / 2}
                y1={height}
                x2={right + strokeWidth / 2}
                y2={height}
                stroke={zone.color}
                strokeWidth={strokeWidth}
            /> */}

            {/* Label */}
            {zone.labelWrap && (
                <TextWrapSvg
                    textWrap={zone.labelWrap}
                    x={textX}
                    y={labelY}
                    fill={GRAPHER_DARK_TEXT}
                />
            )}
            {/* Value */}
            {zone.valueWrap && (
                <TextWrapSvg
                    textWrap={zone.valueWrap}
                    x={textX}
                    y={valueY}
                    fill={GRAPHER_LIGHT_TEXT}
                />
            )}
        </>
    )
}

function OverflowAnnotation({
    zone,
    top,
    labelFontSize,
    valueFontSize,
}: {
    zone: AnnotatedZone
    top: number
    labelFontSize: number
    valueFontSize: number
}) {
    if (!zone.overflowAnnotation) return null

    const x = zone.startX
    const lineOffsetX = Math.min(5, zone.width / 3)
    const lineX = x + lineOffsetX
    const lineY1 = top + OVERFLOW_ANNOTATION_BOX_ARROW_GAP
    const lineY2 = lineY1 + OVERFLOW_ANNOTATION_LINE_LENGTH
    const labelY = lineY2 + OVERFLOW_ANNOTATION_LINE_TEXT_GAP

    const labelWrap = new TextWrap({
        text: zone.overflowAnnotation.label,
        maxWidth: Infinity, // Don't wrap
        fontSize: labelFontSize,
        fontWeight: 700,
        lineHeight: 1,
    })
    const valueWrap = new TextWrap({
        text: zone.overflowAnnotation.value,
        maxWidth: Infinity, // Don't wrap
        fontSize: valueFontSize,
        lineHeight: 1,
    })

    return (
        <>
            <line
                x1={lineX}
                y1={lineY1}
                x2={lineX}
                y2={lineY2}
                stroke={GRAPHER_DARK_TEXT}
                strokeWidth={1}
            />
            <TextWrapSvg
                textWrap={labelWrap}
                x={x}
                y={labelY}
                fill={GRAPHER_DARK_TEXT}
            />
            {valueWrap && (
                <TextWrapSvg
                    textWrap={valueWrap}
                    x={x}
                    y={labelY + labelWrap.height + LABEL_VALUE_GAP}
                    fill={GRAPHER_LIGHT_TEXT}
                />
            )}
        </>
    )
}

export function AgeZoneLegend(props: AgeZoneLegendProps) {
    const { parentRef, width } = useParentSize({ debounceTime: 0 })
    return (
        <div ref={parentRef} className="detailed-population-pyramid__bar">
            {width > 0 && <AgeZoneLegendContent {...props} width={width} />}
        </div>
    )
}

function placeZones(
    zones: RawZone[],
    totalWidth: number,
    gap: number
): PlacedZone[] {
    const total = R.sumBy(zones, (zone: RawZone) => zone.population)
    const availableWidth = totalWidth - (zones.length - 1) * gap

    let currentX = 0
    return zones.map((desc) => {
        const fraction = desc.population / total
        const segmentWidth = fraction * availableWidth
        const startX = currentX
        currentX += segmentWidth + gap
        return { ...desc, fraction, startX, width: segmentWidth }
    })
}

function annotateZones(
    zones: PlacedZone[],
    labelFontSize: number,
    valueFontSize: number
): AnnotatedZone[] {
    const fitsOnOneLine = (wrap: TextWrap, maxWidth: number) =>
        wrap.lines.length <= 1 && wrap.width <= maxWidth

    const makeTextWrap = (
        text: string,
        fontSize: number,
        fontWeight?: number
    ) =>
        new TextWrap({
            text,
            maxWidth: Infinity,
            fontSize,
            lineHeight: 1,
            fontWeight,
        })

    return zones.map((zone) => {
        const maxWidth =
            zone.width - 2 * 2 - BOX_PADDING_LEFT - BOX_PADDING_RIGHT

        // Label: try long → short → truncated short with ellipsis
        let labelText = zone.labelLong
        let labelWrap = makeTextWrap(labelText, labelFontSize, 700)
        if (!fitsOnOneLine(labelWrap, maxWidth)) {
            labelText = zone.labelShort
            labelWrap = makeTextWrap(labelText, labelFontSize, 700)
        }
        if (!fitsOnOneLine(labelWrap, maxWidth)) {
            labelText = shortenWithEllipsis(zone.labelShort, maxWidth, {
                fontSize: labelFontSize,
                fontWeight: 700,
            })
            labelWrap = makeTextWrap(labelText, labelFontSize, 700)
        }

        // Maybe show an overflow annotation for the smallest zone
        const smallestZone = R.firstBy(zones, (z) => z.width)
        if (
            zone === smallestZone &&
            (!labelText || labelText.endsWith("…")) &&
            labelText.length <= 5 // Work..., Chil..., Reti...
        ) {
            return {
                ...zone,
                overflowAnnotation: {
                    label: zone.labelLong,
                    value: formatPopulationValueLong(zone.population),
                },
            }
        }

        // Value: try long → short → hide
        const longValue = formatPopulationValueLong(zone.population)
        const longValueWrap = makeTextWrap(longValue, valueFontSize)
        let valueWrap: TextWrap | undefined
        if (fitsOnOneLine(longValueWrap, maxWidth)) {
            valueWrap = longValueWrap
        } else {
            const shortValue = formatPopulationValueShort(zone.population)
            const shortValueWrap = makeTextWrap(shortValue, valueFontSize)
            if (fitsOnOneLine(shortValueWrap, maxWidth)) {
                valueWrap = shortValueWrap
            }
        }

        return { ...zone, labelWrap, valueWrap }
    })
}
