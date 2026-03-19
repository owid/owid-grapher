import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import { Group } from "@visx/group"
import { DENIM_BLUE } from "../helpers/constants.js"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import {
    TextWrap,
    TextWrapSvg,
    shortenWithEllipsis,
} from "@ourworldindata/components"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow.js"
import type { Simulation } from "../helpers/useSimulation"
import type { PopulationBySex } from "../helpers/types.js"
import {
    formatPopulationValueLong,
    formatPopulationValueShort,
} from "../helpers/utils.js"
import { ResponsivePopulationPyramid } from "./PopulationPyramid.js"

// Age zone colors
const WORKING_AGE_COLOR = DENIM_BLUE // 15-64
const DEPENDENT_COLOR = "#8c4569" // 0-14 and 65+ (DarkMauve)
const YOUNG_DEPENDENT_COLOR = DEPENDENT_COLOR
const OLD_DEPENDENT_COLOR = DEPENDENT_COLOR

function getAgeZoneColor(ageGroup: string): string {
    const startAge = parseInt(ageGroup, 10)
    if (startAge < 15) return YOUNG_DEPENDENT_COLOR
    if (startAge >= 65) return OLD_DEPENDENT_COLOR
    return WORKING_AGE_COLOR
}

interface AgeZonePopulation {
    young: number // 0-14
    working: number // 15-64
    old: number // 65+
}

function computeAgeZonePopulation(
    pop: PopulationBySex | null
): AgeZonePopulation {
    if (!pop) return { young: 0, working: 0, old: 0 }
    let young = 0
    let working = 0
    let old = 0
    for (let age = 0; age < pop.female.length; age++) {
        const count = (pop.female[age] || 0) + (pop.male[age] || 0)
        if (age < 15) young += count
        else if (age < 65) working += count
        else old += count
    }
    return { young, working, old }
}

export function DetailedPopulationPyramid({
    simulation,
    year,
}: {
    simulation: Simulation
    year: number
}) {
    const colorByAgeGroup = useCallback(
        (ageGroup: string) => getAgeZoneColor(ageGroup),
        []
    )

    const pop = simulation.getPopulationForYear(year)
    const zonePop = useMemo(() => computeAgeZonePopulation(pop), [pop])

    return (
        <div className="detailed-population-pyramid">
            <ResponsiveAgeZoneBar zonePop={zonePop} year={year} />
            <div className="detailed-population-pyramid__chart">
                <ResponsivePopulationPyramid
                    simulation={simulation}
                    year={year}
                    colorByAgeGroup={colorByAgeGroup}
                    showAgeGroupBackground
                    showAgeZoneLabels
                />
            </div>
        </div>
    )
}

// -- Age zone bar (SVG) --

const BAR_HEIGHT = 20
const BAR_RADIUS = 3
const DIMENSION_LINE_HEIGHT = 20
const FONT_SIZE = 12
const LABEL_FONT_SIZE = 11
const ARROW_HEAD = 4
const SEGMENT_GAP = 1

interface AgeZoneBarProps {
    zonePop: AgeZonePopulation
    year: number
}

function AgeZoneBar({
    zonePop,
    year,
    width,
}: AgeZoneBarProps & { width: number }) {
    const total = zonePop.young + zonePop.working + zonePop.old
    if (total === 0 || width <= 0) return null

    const workingFrac = zonePop.working / total
    const youngFrac = zonePop.young / total
    const oldFrac = zonePop.old / total

    // Segment widths
    const workingW = workingFrac * width
    const youngW = youngFrac * width
    const oldW = oldFrac * width

    // Order: working first, then the bigger dependent group, then the smaller
    const youngIsLarger = zonePop.young >= zonePop.old
    const secondW = youngIsLarger ? youngW : oldW
    const thirdW = youngIsLarger ? oldW : youngW

    const workingX = 0
    const secondX = workingW + SEGMENT_GAP
    const thirdX = secondX + secondW + SEGMENT_GAP

    const youngX = youngIsLarger ? secondX : thirdX
    const oldX = youngIsLarger ? thirdX : secondX

    // Vertical layout
    const dimensionY = 0
    const barY = DIMENSION_LINE_HEIGHT
    const annotationY = barY + BAR_HEIGHT

    // Dimension line
    const dimensionLabel = `Total population: ${formatPopulationValueLong(total)}`
    const dimensionTextWrap = new TextWrap({
        text: dimensionLabel,
        maxWidth: width,
        fontSize: FONT_SIZE,
        lineHeight: 1,
    })
    const dimensionLineY = FONT_SIZE / 2
    const dimensionPadX = 6
    const dimensionTextX = (width - dimensionTextWrap.width) / 2
    const dimensionTextY = dimensionLineY - dimensionTextWrap.height / 2

    // Midline at 50%
    const midX = width / 2

    // Annotation text wraps
    const LABEL_VALUE_GAP = 2
    const fontSettings = { fontSize: FONT_SIZE, fontWeight: 700 }

    const fitsOnOneLine = (wrap: TextWrap, maxW: number) =>
        wrap.lines.length <= 1 && wrap.width <= maxW

    const makeTextWrap = (text: string, fw?: number) =>
        new TextWrap({
            text,
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            lineHeight: 1,
            ...(fw ? { fontWeight: fw } : {}),
        })

    const makeAnnotation = (
        labelLong: string,
        labelShort: string,
        population: number,
        maxW: number
    ) => {
        // Label: try long → short → truncated short with ellipsis
        let labelText = labelLong
        let labelWrap = makeTextWrap(labelText, 700)
        if (!fitsOnOneLine(labelWrap, maxW)) {
            labelText = labelShort
            labelWrap = makeTextWrap(labelText, 700)
        }
        if (!fitsOnOneLine(labelWrap, maxW)) {
            labelText = shortenWithEllipsis(labelShort, maxW, fontSettings)
            labelWrap = makeTextWrap(labelText, 700)
        }

        // Value: try long → short → hide
        const longValue = formatPopulationValueLong(population)
        const longValueWrap = makeTextWrap(longValue)
        let value: TextWrap | undefined
        if (fitsOnOneLine(longValueWrap, maxW)) {
            value = longValueWrap
        } else {
            const shortValue = formatPopulationValueShort(population)
            const shortValueWrap = makeTextWrap(shortValue)
            if (fitsOnOneLine(shortValueWrap, maxW)) {
                value = shortValueWrap
            }
        }

        return { label: labelWrap, value }
    }

    // Actual bracket widths (accounting for gaps and edges)
    const workingBracketW = workingW - 2 // x1+1 to x1+workingW-1
    const secondBracketW = secondW - 2
    const thirdBracketW = width - thirdX - 2 // thirdX+1 to width-1

    const textPad = 8
    const workingAnnotation = makeAnnotation(
        "Working population (15–64 years)",
        "Working population",
        zonePop.working,
        workingBracketW - textPad
    )
    const youngAnnotation = makeAnnotation(
        "Children (<15)",
        "Children",
        zonePop.young,
        (youngIsLarger ? secondBracketW : thirdBracketW) - textPad
    )
    const oldAnnotation = makeAnnotation(
        "Retired (65+)",
        "Retired",
        zonePop.old,
        (youngIsLarger ? thirdBracketW : secondBracketW) - textPad
    )

    const annotations = [workingAnnotation, youngAnnotation, oldAnnotation]

    // Use the tallest annotation to size the bracket
    const annotationTextHeight = Math.max(
        ...annotations.map((a) =>
            a.value
                ? a.label.height + LABEL_VALUE_GAP + a.value.height
                : a.label.height
        )
    )
    const annotationHeight = annotationTextHeight + 10
    const svgHeight = annotationY + annotationHeight

    return (
        <svg width={width} height={svgHeight} overflow="visible">
            {/* Dimension line: arrow with label centered on it */}
            <BezierArrow
                start={[0, dimensionY + dimensionLineY]}
                end={[width, dimensionY + dimensionLineY]}
                color={GRAPHER_LIGHT_TEXT}
                width={1}
                headAnchor="both"
                headLength={ARROW_HEAD}
            />
            <rect
                x={dimensionTextX - dimensionPadX}
                y={dimensionTextY - 1}
                width={dimensionTextWrap.width + dimensionPadX * 2}
                height={dimensionTextWrap.height + 2}
                fill="white"
            />
            <TextWrapSvg
                textWrap={dimensionTextWrap}
                x={dimensionTextX}
                y={dimensionTextY}
                fill={GRAPHER_LIGHT_TEXT}
            />

            {/* Stacked bar segments */}
            <Group top={barY}>
                {/* Rounded clip path */}
                <defs>
                    <clipPath id="bar-clip">
                        <rect
                            width={width}
                            height={BAR_HEIGHT}
                            // rx={BAR_RADIUS}
                        />
                    </clipPath>
                </defs>
                <g clipPath="url(#bar-clip)">
                    <rect
                        x={workingX}
                        width={workingW}
                        height={BAR_HEIGHT}
                        fill={WORKING_AGE_COLOR}
                    />
                    <rect
                        x={youngX}
                        width={youngW}
                        height={BAR_HEIGHT}
                        fill={YOUNG_DEPENDENT_COLOR}
                    />
                    <rect
                        x={oldX}
                        width={oldW}
                        height={BAR_HEIGHT}
                        fill={OLD_DEPENDENT_COLOR}
                    />
                </g>

                {/* Percentage labels */}
                {[
                    { frac: workingFrac, x: workingX, w: workingW },
                    { frac: youngFrac, x: youngX, w: youngW },
                    { frac: oldFrac, x: oldX, w: oldW },
                ].map(({ frac, x, w }, i) => {
                    const pctText = `${Math.round(frac * 100)}%`
                    const pctWrap = new TextWrap({
                        text: pctText,
                        maxWidth: Infinity,
                        fontSize: LABEL_FONT_SIZE,
                        fontWeight: 500,
                    })
                    const PAD = 4
                    if (pctWrap.width + PAD * 2 > w) return null
                    return (
                        <text
                            key={i}
                            x={x + w / 2}
                            y={BAR_HEIGHT / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={LABEL_FONT_SIZE}
                            fontWeight={500}
                            fill="white"
                        >
                            {pctText}
                        </text>
                    )
                })}

                {/* 50% midline */}
                {/* <line
                    x1={midX}
                    y1={-2}
                    x2={midX}
                    y2={BAR_HEIGHT + 2}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={1}
                /> */}
            </Group>

            {/* Annotations below bar */}
            <Group top={annotationY}>
                <AnnotationBracket
                    x1={workingX + 1}
                    x2={workingX + workingW - 1}
                    height={annotationHeight}
                    color={WORKING_AGE_COLOR}
                    labelWrap={workingAnnotation.label}
                    valueWrap={workingAnnotation.value}
                    labelValueGap={LABEL_VALUE_GAP}
                />
                <AnnotationBracket
                    x1={secondX + 1}
                    x2={secondX + secondW - 1}
                    height={annotationHeight}
                    color={youngIsLarger ? YOUNG_DEPENDENT_COLOR : OLD_DEPENDENT_COLOR}
                    labelWrap={youngIsLarger ? youngAnnotation.label : oldAnnotation.label}
                    valueWrap={youngIsLarger ? youngAnnotation.value : oldAnnotation.value}
                    labelValueGap={LABEL_VALUE_GAP}
                />
                <AnnotationBracket
                    x1={thirdX + 1}
                    x2={width - 1}
                    height={annotationHeight}
                    color={youngIsLarger ? OLD_DEPENDENT_COLOR : YOUNG_DEPENDENT_COLOR}
                    labelWrap={youngIsLarger ? oldAnnotation.label : youngAnnotation.label}
                    valueWrap={youngIsLarger ? oldAnnotation.value : youngAnnotation.value}
                    labelValueGap={LABEL_VALUE_GAP}
                />
            </Group>
        </svg>
    )
}

function AnnotationBracket({
    x1,
    x2,
    height,
    color,
    labelWrap,
    valueWrap,
    labelValueGap,
}: {
    x1: number
    x2: number
    height: number
    color: string
    labelWrap: TextWrap
    valueWrap?: TextWrap
    labelValueGap: number
}) {
    const textX = x1 + 5
    const labelY = 5
    const valueY = labelY + labelWrap.height + labelValueGap

    return (
        <>
            {/* Background fill */}
            <rect
                x={x1}
                y={0}
                width={x2 - x1}
                height={height}
                fill={color}
                opacity={0.08}
            />
            {/* Left vertical line */}
            <line
                x1={x1}
                y1={0}
                x2={x1}
                y2={height}
                stroke={color}
                strokeWidth={2}
            />
            {/* Right vertical line */}
            <line
                x1={x2}
                y1={0}
                x2={x2}
                y2={height}
                stroke={color}
                strokeWidth={2}
            />
            {/* Bottom horizontal line */}
            <line
                x1={x1 - 1}
                y1={height}
                x2={x2 + 1}
                y2={height}
                stroke={color}
                strokeWidth={2}
            />
            {/* Label */}
            <TextWrapSvg
                textWrap={labelWrap}
                x={textX}
                y={labelY}
                fill={GRAPHER_DARK_TEXT}
            />
            {/* Value */}
            {valueWrap && (
                <TextWrapSvg
                    textWrap={valueWrap}
                    x={textX}
                    y={valueY}
                    fill={GRAPHER_LIGHT_TEXT}
                />
            )}
        </>
    )
}

function ResponsiveAgeZoneBar({ zonePop, year }: AgeZoneBarProps) {
    const { parentRef, width } = useParentSize({ debounceTime: 0 })
    return (
        <div ref={parentRef} className="detailed-population-pyramid__bar">
            {width > 0 && (
                <AgeZoneBar zonePop={zonePop} year={year} width={width} />
            )}
        </div>
    )
}
