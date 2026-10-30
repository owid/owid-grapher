import * as _ from "lodash-es"
import { VariableSliceDimensions } from "@ourworldindata/types"
import { IndicatorPaneStitch } from "./stitchIndicatorPanes.js"

/**
 * Decides whether a STITCHED multi-indicator page should drop its indicator
 * list altogether: always when the entries carry nothing but their titles
 * (the chart's legend already shows those), and when the indicators are one
 * measure sliced along a single
 * enumerable dimension (age group, sex, year), a list of "0–4, 5–9, 10–14, …"
 * adds nothing the chart legend doesn't already show.
 *
 * Two detectors, structured first:
 * 1. The ETL's slice metadata (`variables.dimensions`): same base column from
 *    the same table, exactly one filter name varying, and that name in a small
 *    allowlist. Deterministic, no text involved.
 * 2. A residue test on the list titles for indicators without that metadata:
 *    strip the tokens every title shares at the start and end, and require
 *    every residue to be a year/decade, an age expression, or a sex word.
 *    Bare numbers never qualify — enumerations like HPV types, hurricane
 *    categories or percentages look exactly like that. (Validated 2026-10-18
 *    against the 408 charts whose slice metadata gives ground truth.)
 *
 * Applies from two indicators up: "men, women" or "under 5, 5–14" tells the
 * reader nothing the legend doesn't. Either way the list only drops when
 * nothing else in the LIST varies:
 * units identical, no WYSK notes, no differing title variant, and any
 * differing short descriptions must vary in the same slot as the titles.
 * Per-indicator producer docs and source links don't depend on the list
 * being shown (they render in their own sections), so they don't block it.
 */

export type SliceClass = "age" | "sex" | "year"

export type IndicatorSliceDims = VariableSliceDimensions

const DIMENSION_CLASS: Record<string, SliceClass> = {
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
// price bases as a time series, so the title test needs four or more.
const MIN_YEARS_FROM_TITLES = 4

export function classifySliceFromDimensions(
    dims: (IndicatorSliceDims | undefined)[]
): SliceClass | undefined {
    if (dims.length < 2 || dims.some((d) => !d)) return undefined
    const defined = dims as IndicatorSliceDims[]
    if (_.uniq(defined.map((d) => d.originalShortName)).length !== 1)
        return undefined
    if (_.uniq(defined.map((d) => d.tablePath ?? "")).length !== 1)
        return undefined
    // A filter missing from some indicators varies too: count "absent" as
    // one more value, or {age, sex} on three indicators and {age} on a fourth
    // would read as varying on age alone.
    const ABSENT = "\u0000absent"
    const names = _.uniq(
        defined.flatMap((d) => (d.filters ?? []).map((f) => f.name))
    )
    const valuesByName = new Map<string, Set<string>>(
        names.map((name) => [
            name,
            new Set(
                defined.map((d) => {
                    const f = (d.filters ?? []).find((x) => x.name === name)
                    return f ? String(f.value) : ABSENT
                })
            ),
        ])
    )
    const varying = [...valuesByName.entries()].filter(([, vs]) => vs.size > 1)
    if (varying.length !== 1) return undefined
    const [name, values] = varying[0]
    const cls = DIMENSION_CLASS[name.toLowerCase()]
    if (!cls) return undefined
    if (cls === "age" && [...values].some((v) => AGE_STANDARDIZED.test(v)))
        return undefined
    return cls
}

const tokenize = (s: string): string[] =>
    (s.toLowerCase().match(/\w+|[^\w\s]/g) ?? []) as string[]

/**
 * Per-title leftover after removing the tokens all titles share at both ends,
 * plus that shared context (so "Ages 0-4 | Ages 5-9" still counts as ages).
 */
function titleResidues(titles: string[]): {
    residues: string[]
    shared: string
} {
    const toks = titles.map(tokenize)
    let pre = 0
    while (toks.every((t) => t.length > pre && t[pre] === toks[0][pre])) pre++
    let suf = 0
    while (
        toks.every(
            (t) =>
                t.length > pre + suf &&
                t[t.length - 1 - suf] === toks[0][toks[0].length - 1 - suf]
        )
    )
        suf++
    return {
        residues: toks.map((t) => t.slice(pre, t.length - suf).join(" ")),
        shared: [
            ...toks[0].slice(0, pre),
            ...toks[0].slice(toks[0].length - suf),
        ].join(" "),
    }
}

const YEAR = /^(?:19|20)\d\d$/
const DECADE = /^(?:1[89]|20)\d0s$/
const SEX =
    /^(?:male|female|males|females|men|women|boys|girls|both sexes|both)$/
const AGE_VOCAB =
    /^(?:(?:ages?|aged|under|over|older|younger|years?|yrs?|olds?|plus|than|to|and|or|less|more|up|at|birth|infancy|infants?|newborns?|adults?|children|child|adolescents?|elderly|all|total|groups?|\d+s?|[-–+<>≥≤(),.]|months?|days?|weeks?)\s*)+$/
// A residue needs digits in an age-like shape (range, "70+", "<5") or an age
// word — and an explicit age word must appear somewhere, in a residue or in
// the shared prefix/suffix, so hectare brackets ("1–2, 2–5, 5–10") or dollar
// thresholds don't pass.
const AGE_SHAPE = /\d+\s*[-–]\s*\d+|\d+\s*\+|[<>≥≤]\s*\d+/
const AGE_WORD =
    /\b(?:under|over|aged|ages?|years?|yrs?|olds?|birth|infancy|older|younger)\b|all ages/

export function classifySliceFromTitles(
    titles: string[]
): SliceClass | undefined {
    const distinct = _.uniq(titles.map((t) => t.trim()))
    if (distinct.length < 2) return undefined
    const { residues: res, shared } = titleResidues(distinct)
    if (res.some((r) => !r)) return undefined
    if (res.every((r) => YEAR.test(r) || DECADE.test(r)))
        return _.uniq(res).length >= MIN_YEARS_FROM_TITLES ? "year" : undefined
    if (res.every((r) => SEX.test(r))) return "sex"
    if (
        res.every(
            (r) => AGE_VOCAB.test(r) && (AGE_SHAPE.test(r) || AGE_WORD.test(r))
        ) &&
        (AGE_WORD.test(shared) || res.some((r) => AGE_WORD.test(r)))
    )
        return "age"
    return undefined
}

export function shouldHideStitchedIndicatorList(
    stitch: IndicatorPaneStitch,
    dims: (IndicatorSliceDims | undefined)[]
): { hide: boolean; sliceClass?: SliceClass } {
    const entries = stitch.list
    // A list of titles alone restates the chart's legend: never show it.
    // (Producer docs and per-indicator source links render in their own
    // sections, so they don't count as list content.)
    if (entries.every((e) => !e.short && !e.unit && !e.note))
        return { hide: true }
    // Anything beyond title/short varying is meaningful: keep the list.
    if (stitch.suppressUnit || stitch.suppressTitleVariant)
        return { hide: false }
    if (entries.some((e) => e.note)) return { hide: false }

    const sliceClass =
        classifySliceFromDimensions(dims) ??
        classifySliceFromTitles(entries.map((e) => e.title))
    if (!sliceClass) return { hide: false }

    // Short descriptions may differ only in the same slot as the titles.
    const shorts = _.uniq(entries.map((e) => e.short ?? ""))
    if (shorts.length > 1 && classifySliceFromTitles(shorts) !== sliceClass)
        return { hide: false }

    return { hide: true, sliceClass }
}
