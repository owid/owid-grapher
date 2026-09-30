import {
    shortenWithEllipsis,
    TEXT_WRAP_BREAK_MARGIN,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import {
    checkIsIncomeGroup,
    formatValue,
    getRegionByName,
} from "@ourworldindata/utils"

import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import {
    Measure,
    NUM_DECIMAL_PLACES_BY_MEASURE,
    SHORT_UNIT_BY_MEASURE,
} from "./types.js"

const ENTITY_NAME_SUFFIXES_TO_STRIP = ["27", "country"]

/** A value of `measure` as the chart writes it; one too small for the measure's precision shows down to its first significant digit */
export function formatMeasureValue(
    value: number,
    measure: Measure,
    {
        withUnit = true,
        showPlus,
    }: { withUnit?: boolean; showPlus?: boolean } = {}
): string {
    return formatValue(value, {
        numDecimalPlaces: Math.max(
            NUM_DECIMAL_PLACES_BY_MEASURE[measure],
            findFirstSignificantDecimalPlace(value)
        ),
        unit: withUnit ? SHORT_UNIT_BY_MEASURE[measure] : undefined,
        showPlus,
    })
}

/** A step's change, with a plus sign unless the step starts from zero */
export function formatStepDelta(
    delta: number,
    measure: Measure,
    { isFromZero, withUnit }: { isFromZero: boolean; withUnit?: boolean }
): string {
    return formatMeasureValue(delta, measure, {
        withUnit,
        showPlus: !isFromZero && delta !== 0,
    })
}

/** A TextWrap cut to at most `maxLines` lines, with an ellipsis on the last one if anything was cut */
export function buildTruncatedTextWrap({
    text,
    maxWidth,
    maxLines,
    fontSize,
    fontWeight,
}: {
    text: string
    maxWidth: number
    maxLines: number
    fontSize: number
    fontWeight: number
}): TextWrap {
    const wrap = new TextWrap({ text, maxWidth, fontSize, fontWeight })
    if (wrap.lines.length <= maxLines) return wrap

    const kept = wrap.lines.slice(0, maxLines).map((line) => line.text)
    kept[kept.length - 1] = shortenWithEllipsis(
        kept[kept.length - 1],
        maxWidth - TEXT_WRAP_BREAK_MARGIN,
        { fontSize, fontWeight }
    )
    return new TextWrap({
        text: kept.join("\n"),
        maxWidth,
        fontSize,
        fontWeight,
    })
}

export function buildTitle(entityName: string, measure: Measure): string {
    const formattedName = formatEntityNameForSentence(
        entityName,
        ENTITY_NAME_SUFFIXES_TO_STRIP
    )
    const verb = isPluralEntityName(entityName) ? "do" : "does"
    return measure === "energy"
        ? `How many calories ${verb} ${formattedName} produce, and where do they go?`
        : `How much protein ${verb} ${formattedName} produce, and where does it go?`
}

export function buildSubtitle(measure: Measure, year: number): string {
    const quantity =
        measure === "energy" ? "number of kilocalories" : "grams of protein"
    return `Measured as the average ${quantity} per person per day at each stage, in ${year}.`
}

/** Whether the entity's name is a plural noun, as income groups' names are */
function isPluralEntityName(entityName: string): boolean {
    const region = getRegionByName(entityName)
    return region !== undefined && checkIsIncomeGroup(region)
}

/** 1 for 0.3, 2 for 0.03; zero or less for values of 1 and above */
function findFirstSignificantDecimalPlace(value: number): number {
    if (value === 0) return 0
    return -Math.floor(Math.log10(Math.abs(value)))
}
