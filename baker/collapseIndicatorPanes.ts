import * as _ from "lodash-es"
import {
    AdditionalIndicator,
    CollapsedIndicatorListEntry,
    DataPageDataV2,
    DatasetOwners,
    OwidOrigin,
} from "@ourworldindata/types"

/**
 * Decides whether a multi-indicator chart's metadata panes can collapse into a
 * single pane + indicator list, and computes everything the collapsed pane
 * needs. Returns undefined when the panes differ substantively (the switcher
 * stays).
 *
 * The rules (settled 2026-09-10):
 * - Panes must match on every field a reader could act on: WYSK
 *   (descriptionKey, with the short-note exception below), processing
 *   description, producer description, attributions, processing level, FAQs,
 *   legacy source — and origins compared ORDER-INSENSITIVELY on their
 *   reader-visible identity (producer, title, versionProducer, attribution,
 *   citationFull, description, dateAccessed, urlMain, license). Internal
 *   origin fields (id, titleSnapshot, urlDownload) are ignored: they are not
 *   rendered in the metadata box and don't reach citations.
 * - dateRange may differ: the collapsed pane shows the min–max union. If any
 *   differing range doesn't parse as "<year>-<year>", the page stays
 *   uncollapsed rather than showing a wrong range.
 * - Dataset owners may differ (indicators spanning datasets): the collapsed
 *   pane shows the union. lastUpdated shows the latest, nextUpdate the
 *   soonest.
 * - WYSK exception: when WYSK is the only differing field and every distinct
 *   WYSK is short (<= MAX_COLLAPSIBLE_WYSK_LENGTH chars), collapse anyway and
 *   carry each pane's WYSK as a note on its list entry. (Motivating case:
 *   annual-number-of-deaths-by-cause — 30 causes with no WYSK, one with a
 *   single sentence.)
 * - Identity fields (title, descriptionShort, unit) never block collapse;
 *   when they differ across panes they move from the pane into the list
 *   entries so the pane can't misattribute one indicator's value to all.
 */

const MAX_COLLAPSIBLE_WYSK_LENGTH = 250

export interface IndicatorPaneCollapse {
    list: CollapsedIndicatorListEntry[]
    dateRange: string
    lastUpdated: string
    nextUpdate?: string
    owners?: DatasetOwners[]
    suppressDescriptionShort: boolean
    suppressUnit: boolean
    suppressDescriptionKey: boolean
}

const canon = (x: unknown): string => JSON.stringify(x ?? null)

// The subset of an origin a reader can actually see (metadata box sources
// accordion) or cite. Compared as a sorted multiset so ETL-side reordering of
// the origins array can't block a collapse.
const visibleOriginIdentity = (o: OwidOrigin): string =>
    canon({
        producer: o.producer,
        title: o.title,
        versionProducer: o.versionProducer,
        attribution: o.attribution,
        citationFull: o.citationFull,
        description: o.description,
        dateAccessed: o.dateAccessed,
        urlMain: o.urlMain,
        license: o.license ?? null,
    })

const originsKey = (origins: OwidOrigin[] | undefined): string =>
    canon([...(origins ?? []).map(visibleOriginIdentity)].sort())

const TIMESPAN_REGEX = /^\s*(-?\d+)-(-?\d+)\s*$/

// Label matching the switcher's labelForIndicator: title, with the
// titleVariant appended when it isn't already part of the title.
const labelFor = (dd: DataPageDataV2): string => {
    const title = dd.title.title
    const variant = dd.titleVariant?.trim()
    return variant && !title.includes(variant)
        ? `${title} – ${variant}`
        : title
}

export function computeIndicatorPaneCollapse(
    panes: AdditionalIndicator[]
): IndicatorPaneCollapse | undefined {
    if (panes.length < 2) return undefined
    const dds = panes.map((p) => p.datapageData)
    const allSame = (get: (dd: DataPageDataV2) => unknown): boolean =>
        new Set(dds.map((dd) => canon(get(dd)))).size === 1

    // Hard blockers: substantive fields that must match exactly.
    if (!allSame((dd) => dd.descriptionProcessing)) return undefined
    if (!allSame((dd) => dd.descriptionFromProducer)) return undefined
    if (!allSame((dd) => dd.attributionShort)) return undefined
    if (!allSame((dd) => dd.owidProcessingLevel)) return undefined
    if (!allSame((dd) => dd.source ?? null)) return undefined
    if (!allSame((dd) => [...(dd.attributions ?? [])].sort())) return undefined
    if (new Set(dds.map((dd) => originsKey(dd.origins))).size > 1)
        return undefined
    if (new Set(panes.map((p) => canon(p.faqEntries ?? null))).size > 1)
        return undefined

    // WYSK: identical, or the short-note exception.
    const wysks = dds.map((dd) => dd.descriptionKey?.trim() ?? "")
    const wyskDiffers = new Set(wysks).size > 1
    if (
        wyskDiffers &&
        wysks.some((w) => w.length > MAX_COLLAPSIBLE_WYSK_LENGTH)
    )
        return undefined

    // dateRange: identical, or a parseable min-max union.
    const ranges = _.uniq(dds.map((dd) => dd.dateRange ?? ""))
    let dateRange = dds[0].dateRange ?? ""
    if (ranges.length > 1) {
        const parsed = ranges.map((r) => TIMESPAN_REGEX.exec(r))
        if (parsed.some((m) => !m)) return undefined
        const starts = parsed.map((m) => parseInt(m![1], 10))
        const ends = parsed.map((m) => parseInt(m![2], 10))
        dateRange = `${Math.min(...starts)}-${Math.max(...ends)}`
    }

    // Owners: union across datasets, primary's dataset name kept for the row.
    const ownersDiffer = !allSame((dd) => dd.owners ?? null)
    let owners: DatasetOwners[] | undefined
    if (ownersDiffer) {
        const names = _.uniq(
            dds.flatMap((dd) => (dd.owners ?? []).flatMap((o) => o.owners))
        )
        const first = dds
            .flatMap((dd) => dd.owners ?? [])
            .find((o) => o.owners.length > 0)
        if (first) owners = [{ ...first, owners: names }]
    }

    const lastUpdated =
        _.max(dds.map((dd) => dd.lastUpdated).filter(Boolean)) ?? ""
    const nextUpdate = _.min(
        dds.map((dd) => dd.nextUpdate).filter((d): d is string => !!d)
    )

    const shortsDiffer = !allSame((dd) => dd.descriptionShort ?? "")
    const unitsDiffer = !allSame((dd) => dd.unit ?? "")

    const list: CollapsedIndicatorListEntry[] = panes.map(({ datapageData: dd }, i) => ({
        title: labelFor(dd),
        short: shortsDiffer ? dd.descriptionShort || undefined : undefined,
        unit: unitsDiffer ? dd.unit || undefined : undefined,
        note: wyskDiffers && wysks[i] ? wysks[i] : undefined,
    }))

    return {
        list,
        dateRange,
        lastUpdated,
        nextUpdate,
        owners,
        suppressDescriptionShort: shortsDiffer,
        suppressUnit: unitsDiffer,
        suppressDescriptionKey: wyskDiffers,
    }
}
