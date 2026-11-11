import {
    shortenWithEllipsis,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import {
    checkIsIncomeGroup,
    formatValue,
    getRegionByName,
} from "@ourworldindata/utils"

import {
    formatEntityNameForSentence,
    stripEntityNameSuffixes,
} from "../../../../helpers/entityNames.js"
import {
    NUM_DECIMAL_PLACES_BY_MEASURE,
    SHORT_UNIT_BY_MEASURE,
} from "./constants.js"
import { Measure } from "./types.js"

const ENTITY_NAME_SUFFIXES_TO_STRIP = ["27", "country"]

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
    const lastLine = shortenWithEllipsis(kept[kept.length - 1], maxWidth, {
        fontSize,
        fontWeight,
    })
    return new TextWrap({
        text: [...kept.slice(0, -1), lastLine].join("\n"),
        maxWidth,
        fontSize,
        fontWeight,
    })
}

export function formatEntityNameForLabel(entityName: string): string {
    return stripEntityNameSuffixes(entityName, ENTITY_NAME_SUFFIXES_TO_STRIP)
}

export function buildTitle(entityName: string, measure: Measure): string {
    const formattedName = formatEntityNameForSentence(
        entityName,
        ENTITY_NAME_SUFFIXES_TO_STRIP
    )
    const verb = isPluralEntityName(entityName) ? "do" : "does"
    return measure === "calories"
        ? `How many calories ${verb} ${formattedName} produce, and where do they go?`
        : `How much protein ${verb} ${formattedName} produce, and where does it go?`
}

export function buildSubtitle(measure: Measure, year: number): string {
    const quantity =
        measure === "calories" ? "number of kilocalories" : "grams of protein"
    return `Measured as the average ${quantity} per person per day at each stage, in ${year}.`
}

function isPluralEntityName(entityName: string): boolean {
    const region = getRegionByName(entityName)
    return region !== undefined && checkIsIncomeGroup(region)
}

function findFirstSignificantDecimalPlace(value: number): number {
    if (value === 0) return 0
    return -Math.floor(Math.log10(Math.abs(value)))
}
