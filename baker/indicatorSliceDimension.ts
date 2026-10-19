import * as _ from "lodash-es"
import { VariableDisplayDimension } from "@ourworldindata/types"
import { IndicatorPaneCollapse } from "./collapseIndicatorPanes.js"

/**
 * Decides whether a MERGED multi-indicator page should drop its indicator
 * list altogether: when the indicators are one measure sliced along a single
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
 * Either way the list only drops when nothing else varies: units identical,
 * no WYSK notes, no differing title variant, and any differing short
 * descriptions must vary in the same slot as the titles.
 */

export type SliceClass = "age" | "sex" | "year"

export interface IndicatorSliceDims {
    originalShortName: string
    filters: VariableDisplayDimension["filters"]
    /** catalogPath before the `#`; two "value" columns from different tables are not the same measure */
    tablePath?: string
}

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

export const MIN_ENTRIES_TO_HIDE_LIST = 4

export function classifySliceFromDimensions(
    dims: (IndicatorSliceDims | undefined)[]
): SliceClass | undefined {
    if (dims.length < 2 || dims.some((d) => !d)) return undefined
    const defined = dims as IndicatorSliceDims[]
    if (_.uniq(defined.map((d) => d.originalShortName)).length !== 1)
        return undefined
    if (_.uniq(defined.map((d) => d.tablePath ?? "")).length !== 1)
        return undefined
    const valuesByName = new Map<string, Set<string>>()
    for (const d of defined)
        for (const f of d.filters ?? []) {
            if (!valuesByName.has(f.name)) valuesByName.set(f.name, new Set())
            valuesByName.get(f.name)!.add(String(f.value))
        }
    const varying = [...valuesByName.entries()].filter(
        ([, vs]) => vs.size > 1
    )
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
export function titleResidues(titles: string[]): {
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
const SEX = /^(?:male|female|males|females|men|women|boys|girls|both sexes|both)$/
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
        return _.uniq(res).length >= MIN_ENTRIES_TO_HIDE_LIST
            ? "year"
            : undefined
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

export function shouldHideCollapsedIndicatorList(
    collapse: IndicatorPaneCollapse,
    dims: (IndicatorSliceDims | undefined)[]
): { hide: boolean; sliceClass?: SliceClass } {
    const entries = collapse.list
    if (entries.length < MIN_ENTRIES_TO_HIDE_LIST) return { hide: false }
    // Anything beyond title/short varying is meaningful: keep the list.
    if (collapse.suppressUnit || collapse.suppressTitleVariant)
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
