import * as _ from "lodash-es"
import { getOriginIdentityKey } from "@ourworldindata/utils"
import { appendTitleVariant } from "../site/datapageUtils.js"
import {
    DataPageDataV2,
    DatasetOwners,
    IndicatorPaneData,
    OwidProcessingLevel,
    SourceLinksByIndicator,
    StitchedIndicator,
} from "@ourworldindata/types"

// A longer "What you should know" is an indicator's own story and keeps its
// own pane
const MAX_STITCHABLE_DESCRIPTION_KEY_LENGTH = 250

// "<year>-<year>", or a single year
const TIMESPAN_REGEX = /^\s*(-?\d+)(?:-(-?\d+))?\s*$/

export interface StitchedPanes {
    /**
     * The one pane's data: what the indicators share, with their date ranges,
     * update dates and owners combined
     */
    datapageData: DataPageDataV2
    indicators: StitchedIndicator[]
    sourceLinksByIndicator: SourceLinksByIndicator[]
}

const differ = (values: unknown[]): boolean =>
    _.uniqWith(values, _.isEqual).length > 1

/** What a reader could act on: panes that differ in any of it stay apart. */
const getFieldsThatMustMatch = ({
    datapageData,
    faqEntries,
}: IndicatorPaneData): unknown[] => [
    datapageData.descriptionProcessing ?? null,
    datapageData.attributionShort ?? null,
    datapageData.source ?? null,
    [...(datapageData.attributions ?? [])].sort(),
    // The same sources in any order, each counted once. Their links and
    // citations may differ: see getSourceLinksByIndicator.
    _.uniq((datapageData.origins ?? []).map(getOriginIdentityKey)).sort(),
    faqEntries ?? null,
]

/** The span from the earliest start to the latest end, if every range parses. */
function combineDateRanges(dateRanges: string[]): string | undefined {
    const timespans = dateRanges.map((dateRange) => {
        const match = TIMESPAN_REGEX.exec(dateRange)
        if (!match) return undefined
        const start = parseInt(match[1], 10)
        return { start, end: match[2] ? parseInt(match[2], 10) : start }
    })
    if (timespans.includes(undefined)) return undefined
    const parsed = _.compact(timespans)
    const start = Math.min(...parsed.map((timespan) => timespan.start))
    const end = Math.max(...parsed.map((timespan) => timespan.end))
    return `${start}-${end}`
}

/** Everyone who manages one of the indicators' datasets, in a single entry. */
function combineOwners(
    ownersByIndicator: (DatasetOwners[] | undefined)[]
): DatasetOwners[] | undefined {
    const datasets = ownersByIndicator.flatMap((owners) => owners ?? [])
    const firstWithOwners = datasets.find(
        (dataset) => dataset.owners.length > 0
    )
    if (!firstWithOwners) return undefined
    const owners = _.uniq(datasets.flatMap((dataset) => dataset.owners))
    return [{ ...firstWithOwners, owners }]
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
 * For each source whose link or full citation differs between the indicators
 * (one World Bank source with a landing page per indicator, say), every
 * indicator's own.
 */
function getSourceLinksByIndicator(
    panes: DataPageDataV2[],
    indicators: StitchedIndicator[]
): SourceLinksByIndicator[] {
    return (panes[0].origins ?? []).flatMap((origin, originIndex) => {
        const key = getOriginIdentityKey(origin)
        const originByIndicator = panes.map((pane) =>
            (pane.origins ?? []).find(
                (paneOrigin) => getOriginIdentityKey(paneOrigin) === key
            )
        )
        const linksDiffer = differ(
            originByIndicator.map((indicatorOrigin) => [
                indicatorOrigin?.urlMain ?? null,
                indicatorOrigin?.citationFull ?? null,
            ])
        )
        if (!linksDiffer) return []
        const links = originByIndicator.flatMap((indicatorOrigin, i) =>
            indicatorOrigin
                ? [
                      {
                          label: appendTitleVariant(
                              indicators[i].title,
                              indicators[i].titleVariant
                          ),
                          retrievedFrom: indicatorOrigin.urlMain,
                          citation: indicatorOrigin.citationFull,
                      },
                  ]
                : []
        )
        return [{ originIndex, links }]
    })
}

/**
 * Stitches the panes of a chart with several indicators into one, when they
 * agree on everything a reader could act on. Returns undefined when they
 * don't, and the box then keeps a pane per indicator behind a switcher.
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
): StitchedPanes | undefined {
    if (panes.length < 2) return undefined
    if (differ(panes.map(getFieldsThatMustMatch))) return undefined

    const data = panes.map((pane) => pane.datapageData)
    const [primary] = data

    const descriptionKeys = data.map(
        (pane) => pane.descriptionKey?.trim() ?? ""
    )
    const descriptionKeysDiffer = differ(descriptionKeys)
    if (
        descriptionKeysDiffer &&
        descriptionKeys.some(
            (key) => key.length > MAX_STITCHABLE_DESCRIPTION_KEY_LENGTH
        )
    )
        return undefined

    const dateRangesDiffer = differ(data.map((pane) => pane.dateRange))
    const dateRange = dateRangesDiffer
        ? combineDateRanges(data.map((pane) => pane.dateRange))
        : primary.dateRange
    if (dateRange === undefined) return undefined

    const titleVariantsDiffer = differ(
        data.map((pane) => pane.titleVariant?.trim() ?? "")
    )
    const descriptionShortsDiffer = differ(
        data.map((pane) => pane.descriptionShort ?? "")
    )
    const unitsDiffer = differ(data.map((pane) => pane.unit ?? ""))
    const producerDescriptionsDiffer = differ(
        data.map((pane) => pane.descriptionFromProducer ?? "")
    )

    const indicators = data.map((pane, i): StitchedIndicator => ({
        title: pane.title.title,
        titleVariant: titleVariantsDiffer
            ? pane.titleVariant?.trim() || undefined
            : undefined,
        descriptionShort: descriptionShortsDiffer
            ? pane.descriptionShort || undefined
            : undefined,
        unit: unitsDiffer ? pane.unit || undefined : undefined,
        descriptionKey: descriptionKeysDiffer
            ? descriptionKeys[i] || undefined
            : undefined,
        dateRange: dateRangesDiffer ? pane.dateRange || undefined : undefined,
        descriptionFromProducer: producerDescriptionsDiffer
            ? pane.descriptionFromProducer || undefined
            : undefined,
    }))

    const ownersDiffer = differ(data.map((pane) => pane.owners ?? null))

    return {
        datapageData: {
            ...primary,
            title: titleVariantsDiffer
                ? { ...primary.title, titleVariant: undefined }
                : primary.title,
            titleVariant: titleVariantsDiffer
                ? undefined
                : primary.titleVariant,
            descriptionShort: descriptionShortsDiffer
                ? undefined
                : primary.descriptionShort,
            unit: unitsDiffer ? undefined : primary.unit,
            descriptionKey: descriptionKeysDiffer
                ? undefined
                : primary.descriptionKey,
            descriptionFromProducer: producerDescriptionsDiffer
                ? undefined
                : primary.descriptionFromProducer,
            dateRange,
            lastUpdated: _.max(data.map((pane) => pane.lastUpdated)) ?? "",
            nextUpdate: _.min(_.compact(data.map((pane) => pane.nextUpdate))),
            owners:
                (ownersDiffer
                    ? combineOwners(data.map((pane) => pane.owners))
                    : undefined) ?? primary.owners,
            owidProcessingLevel: getHighestProcessingLevel(
                data.map((pane) => pane.owidProcessingLevel)
            ),
        },
        indicators,
        sourceLinksByIndicator: getSourceLinksByIndicator(data, indicators),
    }
}
