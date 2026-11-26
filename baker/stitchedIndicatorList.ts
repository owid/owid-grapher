import * as _ from "lodash-es"
import {
    StitchedIndicator,
    VariableSliceDimensions,
} from "@ourworldindata/types"

/**
 * Whether a stitched data page lists its indicators. The list is left out
 * when it would only repeat the chart's legend:
 * - when the indicators differ in nothing but their titles, or
 * - when they are one measure sliced by age group, sex or year, so that the
 *   list would read "0–4, 5–9, 10–14, …". Their short descriptions may then
 *   differ only in the way their titles do.
 *
 * Units, "What you should know" or title variants that differ are always
 * worth listing.
 *
 * A slice is recognised from the ETL's slice metadata where the indicators
 * have it (see classifySliceFromDimensions), and otherwise from their titles
 * (see classifySliceFromTitles).
 */

export type SliceClass = "age" | "sex" | "year"

const SLICE_CLASS_BY_FILTER_NAME: Record<string, SliceClass> = {
    age: "age",
    age_group: "age",
    agegroup: "age",
    agegroup_code: "age",
    decadal_age: "age",
    sex: "sex",
    sex_code: "sex",
    gender: "sex",
    year: "year",
    year_as_dimension: "year",
}

// An age-standardized series is a different measure from the age brackets
// beside it, so a list that contains one stays.
const AGE_STANDARDIZED = /standardi[sz]ed/i

// Two or three years ("2022, 2024, 2026") are as often report editions or
// price bases as a time series.
const MIN_YEARS_FROM_TITLES = 4

const YEAR = /^(?:19|20)\d\d$/
const DECADE = /^(?:1[89]|20)\d0s$/
const SEX =
    /^(?:male|female|males|females|men|women|boys|girls|both sexes|both)$/
const AGE_VOCABULARY =
    /^(?:(?:ages?|aged|under|over|older|younger|years?|yrs?|olds?|plus|than|to|and|or|less|more|up|at|birth|infancy|infants?|newborns?|adults?|children|child|adolescents?|elderly|all|total|groups?|\d+s?|[-–+<>≥≤(),.]|months?|days?|weeks?)\s*)+$/
// Digits in the shape of an age: a range, "70+" or "<5"
const AGE_SHAPE = /\d+\s*[-–]\s*\d+|\d+\s*\+|[<>≥≤]\s*\d+/
const AGE_WORD =
    /\b(?:under|over|aged|ages?|years?|yrs?|olds?|birth|infancy|older|younger)\b|all ages/

const differ = (values: unknown[]): boolean => _.uniq(values).length > 1

/**
 * The slice the indicators differ by, going by the ETL's slice metadata: they
 * must be cut from the same column of the same table, and differ in exactly
 * one filter, which is an age, sex or year.
 */
export function classifySliceFromDimensions(
    sliceDimensions: (VariableSliceDimensions | undefined)[]
): SliceClass | undefined {
    const dimensions = _.compact(sliceDimensions)
    if (dimensions.length < 2 || dimensions.length < sliceDimensions.length)
        return undefined
    if (differ(dimensions.map((d) => d.originalShortName))) return undefined
    if (differ(dimensions.map((d) => d.tablePath))) return undefined

    const filterNames = _.uniq(
        dimensions.flatMap((d) => d.filters.map((filter) => filter.name))
    )
    // A filter only some indicators have differs between them too: null
    // counts as one more value
    const valuesByFilterName = filterNames.map((name) => ({
        name,
        values: dimensions.map((d) => {
            const filter = d.filters.find((filter) => filter.name === name)
            return filter ? String(filter.value) : null
        }),
    }))
    const [varyingFilter, ...otherVaryingFilters] = valuesByFilterName.filter(
        ({ values }) => differ(values)
    )
    if (!varyingFilter || otherVaryingFilters.length > 0) return undefined

    const sliceClass =
        SLICE_CLASS_BY_FILTER_NAME[varyingFilter.name.toLowerCase()]
    const hasAgeStandardizedSeries = varyingFilter.values.some(
        (value) => value !== null && AGE_STANDARDIZED.test(value)
    )
    if (sliceClass === "age" && hasAgeStandardizedSeries) return undefined
    return sliceClass
}

const tokenize = (text: string): string[] =>
    text.toLowerCase().match(/\w+|[^\w\s]/g) ?? []

/**
 * What is left of each title once the words they all start and end with are
 * removed, and those shared words.
 */
function getTitleResidues(titles: string[]): {
    residues: string[]
    shared: string
} {
    const tokenLists = titles.map(tokenize)
    const [first] = tokenLists
    let prefixLength = 0
    while (
        tokenLists.every(
            (tokens) =>
                tokens.length > prefixLength &&
                tokens[prefixLength] === first[prefixLength]
        )
    )
        prefixLength++
    let suffixLength = 0
    while (
        tokenLists.every(
            (tokens) =>
                tokens.length > prefixLength + suffixLength &&
                tokens[tokens.length - 1 - suffixLength] ===
                    first[first.length - 1 - suffixLength]
        )
    )
        suffixLength++
    return {
        residues: tokenLists.map((tokens) =>
            tokens.slice(prefixLength, tokens.length - suffixLength).join(" ")
        ),
        shared: [
            ...first.slice(0, prefixLength),
            ...first.slice(first.length - suffixLength),
        ].join(" "),
    }
}

/**
 * The slice the titles differ by: what remains of each, once their shared
 * words are removed, must be a year or decade, a sex, or an age. Ages need an
 * age word somewhere ("Ages 0-4 | Ages 5-9"), since bare numbers are as
 * likely to be hurricane categories, hectare brackets or dollar thresholds.
 */
export function classifySliceFromTitles(
    titles: string[]
): SliceClass | undefined {
    const distinctTitles = _.uniq(titles.map((title) => title.trim()))
    if (distinctTitles.length < 2) return undefined
    const { residues, shared } = getTitleResidues(distinctTitles)
    if (residues.some((residue) => !residue)) return undefined
    if (residues.every((residue) => YEAR.test(residue) || DECADE.test(residue)))
        return _.uniq(residues).length >= MIN_YEARS_FROM_TITLES
            ? "year"
            : undefined
    if (residues.every((residue) => SEX.test(residue))) return "sex"
    const residuesReadAsAges = residues.every(
        (residue) =>
            AGE_VOCABULARY.test(residue) &&
            (AGE_SHAPE.test(residue) || AGE_WORD.test(residue))
    )
    const hasAgeWord =
        AGE_WORD.test(shared) ||
        residues.some((residue) => AGE_WORD.test(residue))
    return residuesReadAsAges && hasAgeWord ? "age" : undefined
}

export function shouldShowIndicatorList(
    indicators: StitchedIndicator[],
    /** Each indicator's ETL slice metadata, in the same order */
    sliceDimensions: (VariableSliceDimensions | undefined)[]
): boolean {
    const hasMoreThanTitles = indicators.some(
        (indicator) =>
            indicator.descriptionShort ||
            indicator.unit ||
            indicator.descriptionKey
    )
    if (!hasMoreThanTitles) return false
    if (
        indicators.some(
            (indicator) =>
                indicator.unit ||
                indicator.descriptionKey ||
                indicator.titleVariant
        )
    )
        return true

    const sliceClass =
        classifySliceFromDimensions(sliceDimensions) ??
        classifySliceFromTitles(indicators.map((indicator) => indicator.title))
    if (!sliceClass) return true

    const descriptions = _.uniq(
        indicators.map((indicator) => indicator.descriptionShort ?? "")
    )
    return (
        descriptions.length > 1 &&
        classifySliceFromTitles(descriptions) !== sliceClass
    )
}
