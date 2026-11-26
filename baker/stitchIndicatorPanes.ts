import * as _ from "lodash-es"
import { getOriginIdentityKey, parseTimespan } from "@ourworldindata/utils"
import { appendTitleVariant } from "../site/datapageUtils.js"
import {
    DataPageDataV2,
    IndicatorPaneData,
    OwidProcessingLevel,
    SourceWithIndicatorLinks,
    StitchedIndicator,
} from "@ourworldindata/types"

// A longer "What you should know" is an indicator's own story and keeps its
// own pane
const MAX_STITCHABLE_DESCRIPTION_KEY_LENGTH = 250

export interface StitchedPane {
    /**
     * What the indicators share, with their date ranges, update dates and
     * owners combined
     */
    datapageData: DataPageDataV2
    indicators: StitchedIndicator[]
    sourcesWithIndicatorLinks: SourceWithIndicatorLinks[]
}

export const differ = (values: unknown[]): boolean =>
    _.uniqWith(values, _.isEqual).length > 1

/** What a reader could act on: panes that differ in any of it stay apart. */
const getFieldsThatMustMatch = ({
    datapageData,
    faqEntries,
}: IndicatorPaneData): Record<string, unknown> => ({
    descriptionProcessing: datapageData.descriptionProcessing ?? null,
    attributionShort: datapageData.attributionShort ?? null,
    attributions: [...(datapageData.attributions ?? [])].sort(),
    legacySource: datapageData.source ?? null,
    // The same sources in any order, each counted once. Their links and
    // citations may differ: see getSourcesWithIndicatorLinks.
    sources: _.uniq(
        (datapageData.origins ?? []).map(getOriginIdentityKey)
    ).sort(),
    faqEntries: faqEntries ?? null,
})

/**
 * The indicators' values of a text field if they differ, or undefined if
 * they agree.
 */
function getDifferingValues(
    values: (string | undefined)[]
): (string | undefined)[] | undefined {
    const trimmedValues = values.map((value) => value?.trim() || undefined)
    return differ(trimmedValues) ? trimmedValues : undefined
}

/** The span from the earliest year to the latest, if every range parses. */
function combineDateRanges(dateRanges: string[]): string | undefined {
    const timespans = dateRanges.map(parseTimespan)
    if (timespans.includes(null)) return undefined
    const years = _.compact(timespans)
    const firstYear = Math.min(...years.map((span) => span.firstYear))
    const lastYear = Math.max(...years.map((span) => span.lastYear))
    return `${firstYear}-${lastYear}`
}

/** Understating the processing would mislead, so the highest level wins. */
function getHighestProcessingLevel(
    levels: (OwidProcessingLevel | undefined)[]
): OwidProcessingLevel | undefined {
    if (levels.includes("major")) return "major"
    if (levels.includes("minor")) return "minor"
    return undefined
}

/**
 * The sources whose link or full citation differs between the indicators
 * (one World Bank source with a landing page for each, say), with every
 * indicator's own.
 */
function getSourcesWithIndicatorLinks(
    panes: DataPageDataV2[],
    indicators: StitchedIndicator[]
): SourceWithIndicatorLinks[] {
    return (panes[0].origins ?? []).flatMap((origin, originIndex) => {
        const key = getOriginIdentityKey(origin)
        // An indicator can list a source more than once, for two snapshots
        // of it, and so have more than one link to it
        const linksOfEachIndicator = panes.map((pane) =>
            _.uniqWith(
                (pane.origins ?? [])
                    .filter(
                        (paneOrigin) => getOriginIdentityKey(paneOrigin) === key
                    )
                    .map((paneOrigin) => ({
                        retrievedFrom: paneOrigin.urlMain,
                        citation: paneOrigin.citationFull,
                    })),
                _.isEqual
            )
        )
        const [linksOfFirstIndicator] = linksOfEachIndicator
        const allHaveTheSameLinks = linksOfEachIndicator.every((links) =>
            _.isEmpty(_.xorWith(links, linksOfFirstIndicator, _.isEqual))
        )
        if (allHaveTheSameLinks) return []

        const indicatorLinks = linksOfEachIndicator.flatMap((links, i) =>
            links.map((link) => ({
                label: appendTitleVariant(
                    indicators[i].title,
                    indicators[i].titleVariant
                ),
                ...link,
            }))
        )
        return [{ originIndex, indicatorLinks }]
    })
}

/**
 * Stitches the panes of a chart with several indicators into one, when they
 * agree on everything a reader could act on. Returns undefined when they
 * don't, and the box then keeps a pane for each indicator behind a switcher.
 *
 * The panes must have the same processing description, attributions (short
 * and full), FAQs, legacy source and set of data sources. Beyond that:
 * - A source the indicators share may link or cite differently for each. The
 *   Sources section then lists each indicator's own.
 * - "What you should know" may differ if every version is short. Each then
 *   goes on its own indicator, as do short descriptions, units, title
 *   variants and producer documentation that differ. The pane drops whatever
 *   has moved to the indicators, since the primary indicator's value would
 *   read as true of all of them.
 * - Date ranges, update dates and dataset owners may differ, and the pane
 *   shows them combined. A date range that doesn't parse keeps the panes
 *   apart, so the pane never shows a wrong one.
 * - The processing level may differ when the processing description doesn't
 *   (an annual average we compute next to the monthly series it comes from).
 */
export function stitchIndicatorPanes(
    panes: IndicatorPaneData[]
): StitchedPane | undefined {
    if (panes.length < 2) return undefined
    if (differ(panes.map(getFieldsThatMustMatch))) return undefined

    const data = panes.map((pane) => pane.datapageData)
    const [primary] = data

    const descriptionKeys = getDifferingValues(
        data.map((pane) => pane.descriptionKey)
    )
    const isAnyDescriptionKeyLong = descriptionKeys?.some(
        (descriptionKey) =>
            (descriptionKey ?? "").length >
            MAX_STITCHABLE_DESCRIPTION_KEY_LENGTH
    )
    if (isAnyDescriptionKeyLong) return undefined

    const dateRanges = getDifferingValues(data.map((pane) => pane.dateRange))
    const dateRange = dateRanges
        ? combineDateRanges(data.map((pane) => pane.dateRange))
        : primary.dateRange
    if (dateRange === undefined) return undefined

    const titleVariants = getDifferingValues(
        data.map((pane) => pane.titleVariant)
    )
    const descriptionShorts = getDifferingValues(
        data.map((pane) => pane.descriptionShort)
    )
    const units = getDifferingValues(data.map((pane) => pane.unit))
    const producerDescriptions = getDifferingValues(
        data.map((pane) => pane.descriptionFromProducer)
    )

    const indicators = data.map((pane, i): StitchedIndicator => ({
        title: pane.title.title,
        titleVariant: titleVariants?.[i],
        descriptionShort: descriptionShorts?.[i],
        unit: units?.[i],
        descriptionKey: descriptionKeys?.[i],
        dateRange: dateRanges?.[i],
        descriptionFromProducer: producerDescriptions?.[i],
    }))

    return {
        datapageData: {
            ...primary,
            title: titleVariants
                ? { ...primary.title, titleVariant: undefined }
                : primary.title,
            titleVariant: titleVariants ? undefined : primary.titleVariant,
            descriptionShort: descriptionShorts
                ? undefined
                : primary.descriptionShort,
            unit: units ? undefined : primary.unit,
            descriptionKey: descriptionKeys
                ? undefined
                : primary.descriptionKey,
            descriptionFromProducer: producerDescriptions
                ? undefined
                : primary.descriptionFromProducer,
            dateRange,
            lastUpdated: _.max(data.map((pane) => pane.lastUpdated)) ?? "",
            nextUpdate: _.min(_.compact(data.map((pane) => pane.nextUpdate))),
            owners: _.uniqBy(
                data.flatMap((pane) => pane.owners ?? []),
                (dataset) => dataset.datasetId
            ),
            owidProcessingLevel: getHighestProcessingLevel(
                data.map((pane) => pane.owidProcessingLevel)
            ),
        },
        indicators,
        sourcesWithIndicatorLinks: getSourcesWithIndicatorLinks(
            data,
            indicators
        ),
    }
}
