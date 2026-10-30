import * as _ from "lodash-es"
import { getOriginIdentityKey } from "@ourworldindata/utils"
import { appendTitleVariant } from "../site/datapageUtils.js"
import {
    AdditionalIndicator,
    StitchedIndicatorListEntry,
    DataPageDataV2,
    DatasetOwners,
    OwidOrigin,
    OwidProcessingLevel,
} from "@ourworldindata/types"

/**
 * Decides whether a multi-indicator chart's metadata panes can be stitched into a
 * single pane + indicator list, and computes everything the stitched pane
 * needs. Returns undefined when the panes differ substantively (the switcher
 * stays).
 *
 * The rules:
 * - Panes must match on every field a reader could act on: WYSK
 *   (descriptionKey, with the short-note exception below), processing
 *   description, attributions, FAQs, legacy source, and
 *   the SET of data sources. Sources are compared order-insensitively by
 *   identity (`getOriginIdentityKey`: producer, title, version, attribution,
 *   description, access date), as a set — duplicates don't count.
 * - A shared source whose link or full citation (urlMain, citationFull)
 *   differs per indicator still stitches: list entries carry each
 *   indicator's `sources` and the Sources section shows them per indicator.
 * - Producer documentation may differ: the pane drops its own and list
 *   entries carry each indicator's `producerDescription`, rendered as nested
 *   toggles under "Documentation from data sources".
 * - Processing LEVEL may differ when the processing text matches (e.g.
 *   seawater-ph: an annual average OWID computes is "major", the monthly
 *   series "minor"): the stitched pane shows the highest level.
 * - dateRange may differ: the stitched pane shows the min–max union and the
 *   list entries carry their own ranges. If any
 *   differing range doesn't parse as "<year>-<year>", the page stays
 *   unstitched rather than showing a wrong range.
 * - Dataset owners may differ (indicators spanning datasets): the stitched
 *   pane shows the union. lastUpdated shows the latest, nextUpdate the
 *   soonest.
 * - WYSK exception: when WYSK is the only differing field and every distinct
 *   WYSK is short (<= MAX_STITCHABLE_WYSK_LENGTH chars), stitch anyway and
 *   carry each pane's WYSK as a note on its list entry. (Motivating case:
 *   annual-number-of-deaths-by-cause — 30 causes with no WYSK, one with a
 *   single sentence.)
 * - Identity fields (title, descriptionShort, unit) never block stitching;
 *   when they differ across panes they move from the pane into the list
 *   entries so the pane can't misattribute one indicator's value to all.
 */

const MAX_STITCHABLE_WYSK_LENGTH = 250

export interface IndicatorPaneStitch {
    list: StitchedIndicatorListEntry[]
    dateRange: string
    lastUpdated: string
    nextUpdate?: string
    owners?: DatasetOwners[]
    // The highest processing level among the indicators ("major" beats
    // "minor"): the stitched pane's source line can't name one per indicator,
    // and understating processing would mislead.
    owidProcessingLevel?: OwidProcessingLevel
    suppressDescriptionShort: boolean
    suppressUnit: boolean
    suppressDescriptionKey: boolean
    // True when the indicators carry different titleVariants: each list entry
    // then keeps its own suffix and the pane drops its titleVariant. When all
    // share one variant the entries omit it and the pane keeps it (the list
    // intro states it once).
    suppressTitleVariant: boolean
    // Producer documentation differs per indicator: the pane drops its own
    // and the list entries carry each indicator's, rendered as nested toggles.
    suppressDescriptionFromProducer: boolean
}

const canon = (x: unknown): string => JSON.stringify(x ?? null)

// Same SET of sources (by identity) is the requirement; a shared source whose
// link/citation differs per indicator is allowed and surfaces per indicator.
// A SET: one indicator listing the same source twice (two snapshots of one
// dataset) has the same sources as one listing it once.
const originsKey = (origins: OwidOrigin[] | undefined): string =>
    canon(_.uniq((origins ?? []).map(getOriginIdentityKey)).sort())
const originContent = (o: OwidOrigin): string =>
    canon({ urlMain: o.urlMain ?? null, citationFull: o.citationFull ?? null })

const TIMESPAN_REGEX = /^\s*(-?\d+)-(-?\d+)\s*$/

// List entries use the self-contained pane title (titlePublic first), not
// the chart dimension name the pills use.
const labelFor = (dd: DataPageDataV2, withVariant: boolean): string =>
    withVariant
        ? appendTitleVariant(dd.title.title, dd.titleVariant)
        : dd.title.title

const findOrigin = (
    dd: DataPageDataV2,
    identityKey: string
): OwidOrigin | undefined =>
    (dd.origins ?? []).find((o) => getOriginIdentityKey(o) === identityKey)

export function computeIndicatorPaneStitch(
    panes: AdditionalIndicator[]
): IndicatorPaneStitch | undefined {
    if (panes.length < 2) return undefined
    const dds = panes.map((p) => p.datapageData)
    const allSame = (get: (dd: DataPageDataV2) => unknown): boolean =>
        new Set(dds.map((dd) => canon(get(dd)))).size === 1

    // Hard blockers: substantive fields that must match exactly.
    if (!allSame((dd) => dd.descriptionProcessing)) return undefined
    if (!allSame((dd) => dd.attributionShort)) return undefined
    if (!allSame((dd) => dd.source ?? null)) return undefined
    if (!allSame((dd) => [...(dd.attributions ?? [])].sort())) return undefined
    if (new Set(dds.map((dd) => originsKey(dd.origins))).size > 1)
        return undefined
    if (new Set(panes.map((p) => canon(p.faqEntries ?? null))).size > 1)
        return undefined

    // WYSK: identical, or the short-note exception.
    const wysks = dds.map((dd) => dd.descriptionKey?.trim() ?? "")
    const wyskDiffers = new Set(wysks).size > 1
    if (wyskDiffers && wysks.some((w) => w.length > MAX_STITCHABLE_WYSK_LENGTH))
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

    const producerDocsDiffer = !allSame(
        (dd) => dd.descriptionFromProducer ?? ""
    )
    // Shared sources whose per-indicator content (link, citation) differs.
    const varyingSourceKeys = _.uniq(
        (dds[0].origins ?? []).map(getOriginIdentityKey)
    ).filter((key) => {
        const contents = dds.map((dd) => {
            const o = findOrigin(dd, key)
            return o ? originContent(o) : ""
        })
        return new Set(contents).size > 1
    })

    const shortsDiffer = !allSame((dd) => dd.descriptionShort ?? "")
    const unitsDiffer = !allSame((dd) => dd.unit ?? "")
    // A variant shared by every indicator ("period tables" on all 19 age
    // groups) is said once in the intro, not appended to every entry.
    const variantsDiffer = !allSame((dd) => dd.titleVariant?.trim() ?? "")

    const list: StitchedIndicatorListEntry[] = panes.map(
        ({ datapageData: dd }, i) => ({
            title: labelFor(dd, variantsDiffer),
            short: shortsDiffer ? dd.descriptionShort || undefined : undefined,
            unit: unitsDiffer ? dd.unit || undefined : undefined,
            note: wyskDiffers && wysks[i] ? wysks[i] : undefined,
            dateRange:
                ranges.length > 1 ? dd.dateRange || undefined : undefined,
            producerDescription: producerDocsDiffer
                ? dd.descriptionFromProducer || undefined
                : undefined,
            sources:
                varyingSourceKeys.length > 0
                    ? varyingSourceKeys.flatMap((key) => {
                          const o = findOrigin(dd, key)
                          return o
                              ? [
                                    {
                                        key,
                                        urlMain: o.urlMain,
                                        citationFull: o.citationFull,
                                    },
                                ]
                              : []
                      })
                    : undefined,
        })
    )

    const levels = dds.map((dd) => dd.owidProcessingLevel)
    const owidProcessingLevel: OwidProcessingLevel | undefined =
        levels.includes("major")
            ? "major"
            : levels.includes("minor")
              ? "minor"
              : undefined

    return {
        list,
        dateRange,
        lastUpdated,
        nextUpdate,
        owners,
        owidProcessingLevel,
        suppressDescriptionShort: shortsDiffer,
        suppressUnit: unitsDiffer,
        suppressDescriptionKey: wyskDiffers,
        suppressTitleVariant: variantsDiffer,
        suppressDescriptionFromProducer: producerDocsDiffer,
    }
}

/**
 * Applies a stitch to the primary pane's data in place: the union fields
 * (date range, update dates, owners) replace the primary's, and every field
 * that differs across the indicators is dropped from the pane — it moves into
 * the list entries, and leaving the primary's value would misattribute it to
 * all of them.
 */
export function applyStitchToDatapageData(
    datapageData: DataPageDataV2,
    stitch: IndicatorPaneStitch
): void {
    datapageData.dateRange = stitch.dateRange
    datapageData.lastUpdated = stitch.lastUpdated
    if (stitch.nextUpdate) datapageData.nextUpdate = stitch.nextUpdate
    if (stitch.owners) datapageData.owners = stitch.owners
    datapageData.owidProcessingLevel = stitch.owidProcessingLevel
    if (stitch.suppressDescriptionShort)
        datapageData.descriptionShort = undefined
    if (stitch.suppressUnit) datapageData.unit = undefined
    if (stitch.suppressDescriptionKey) datapageData.descriptionKey = undefined
    if (stitch.suppressDescriptionFromProducer)
        datapageData.descriptionFromProducer = undefined
    if (stitch.suppressTitleVariant) {
        datapageData.titleVariant = undefined
        datapageData.title = { ...datapageData.title, titleVariant: undefined }
    }
}
