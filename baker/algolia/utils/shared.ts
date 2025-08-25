import * as _ from "lodash-es"
import {
    countries,
    countriesByName,
    incomeGroupsByName,
    DbPlainFeaturedMetricWithParentTagName,
    FeaturedMetricIncomeGroup,
    removeTrailingParenthetical,
    slugify,
    Url,
    lowerCaseFirstLetterUnlessAbbreviation,
} from "@ourworldindata/utils"
import * as Sentry from "@sentry/node"
import {
    getFeaturedMetricsByParentTagName,
    KnexReadonlyTransaction,
} from "../../../db/db.js"
import {
    ChartRecord,
    ChartRecordType,
} from "../../../site/search/searchTypes.js"
import urljoin from "url-join"
import { groupBy } from "remeda"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { incomeGroupMap, REAL_FM_INCOME_GROUPS } from "./types.js"
import { ExpandedFeaturedMetric } from "@ourworldindata/types"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { GRAPHER_ROUTE_FOLDER } from "@ourworldindata/grapher"
import { MarkdownTextWrap } from "@ourworldindata/components"

const countriesWithVariantNames = new Set(
    countries
        .filter((country) => country.variantNames?.length || country.shortName)
        .map((country) => country.name)
)

export const processAvailableEntities = (
    availableEntities: string[] | null
) => {
    if (!availableEntities) return []

    // Algolia is a bit weird with synonyms:
    // If we have a synonym "USA" -> "United States", and we search for "USA",
    // then it seems that Algolia can only find that within `availableEntities`
    // if "USA" is within the first 100-or-so entries of the array.
    // So, the easy solution is to sort the entities to ensure that countries
    // with variant names are at the top.
    // Also, entities containing a hyphen like "low-income countries" can also
    // only be found if they're within the first 100-or-so entries.
    // - @marcelgerber, 2024-03-25
    return _.orderBy(
        availableEntities,
        [
            (entityName) =>
                countriesWithVariantNames.has(
                    removeTrailingParenthetical(entityName)
                ),
            (entityName) => entityName.includes("-"),
            (entityName) => entityName,
        ],
        ["desc", "desc", "asc"]
    )
}

/**
 * Scale records' positive scores to be between two numbers.
 */
export function scaleRecordScores<T extends { score: number }>(
    records: T[],
    range: [number, number]
): T[] {
    const scores = records.map((r) => r.score)
    const [min, max] = range
    const maxScore = Math.max(...scores)
    return records.map((record): T => {
        // For ExplorerView records, we want to keep negative scores,
        // because they're intentionally downranked as near-duplicates of existing views
        if (record.score < 0) return record
        // A value between 0 and 1
        const normalized = record.score / maxScore
        const scaled = Math.round(normalized * (max - min) + min)
        return {
            ...record,
            score: scaled,
        }
    })
}

function createRecordUrl(record: ChartRecord) {
    return Url.fromURL(
        urljoin(
            BAKED_BASE_URL,
            record.type === ChartRecordType.ExplorerView
                ? EXPLORERS_ROUTE_FOLDER
                : GRAPHER_ROUTE_FOLDER,
            record.slug,
            record.queryParams ?? ""
        )
    )
}

function findMatchingRecordByPathnameAndQueryParams(
    records: ChartRecord[],
    featuredMetric: DbPlainFeaturedMetricWithParentTagName
) {
    const fmUrl = Url.fromURL(featuredMetric.url)
    return records.find((record) => {
        const recordUrl = createRecordUrl(record)
        if (fmUrl.pathname !== recordUrl.pathname) return false
        return fmUrl.areQueryParamsEqual(recordUrl)
    })
}

export const MAX_NON_FM_RECORD_SCORE = 10000

/**
 * All featured metrics start at a score of 11000, which places them above all other records
 * in the `explorer-views-and-charts` index.
 * The score is then adjusted based on the ranking of the featured metric within its group.
 */
function calculateFeaturedMetricScore(
    featuredMetric: DbPlainFeaturedMetricWithParentTagName,
    group: DbPlainFeaturedMetricWithParentTagName[]
): number {
    let score = MAX_NON_FM_RECORD_SCORE + 1000
    // If there are 3 FMs in the group, rank 1 gets 3 points, rank 2 gets 2 points, rank 3 gets 1 point.
    // This means we can sort by desc(score) in Algolia and they'll show up according to their rank.
    score += group.length - featuredMetric.ranking
    return score
}

/**
 * FeaturedMetricIncomeGroup.Low -> { name: 'OWID_LIC', members: ["AFG", "BFA", "BDI", etc..] }
 */
function getCorrespondingIncomeGroup(
    incomeGroupName: Exclude<
        FeaturedMetricIncomeGroup,
        FeaturedMetricIncomeGroup.Default
    >
) {
    const owidIncomeGroupName = incomeGroupMap[incomeGroupName]
    const countriesByIncomeGroup = incomeGroupsByName()
    return countriesByIncomeGroup[owidIncomeGroupName]
}

/**
 * If an FM is assigned to the "low" income group, we filter the record's available entities
 * to only include countries in that income group.
 */
function filterAvailableEntities(
    featuredMetric: DbPlainFeaturedMetricWithParentTagName,
    availableEntities: string[]
): string[] {
    if (featuredMetric.incomeGroup === FeaturedMetricIncomeGroup.Default)
        return availableEntities

    const owidIncomeGroup = getCorrespondingIncomeGroup(
        featuredMetric.incomeGroup
    )

    const filteredEntities = availableEntities.filter((entity) => {
        const country = countriesByName()[entity]
        if (!country) return false
        return owidIncomeGroup.members.includes(country.code)
    })

    return filteredEntities
}

function generateObjectID(
    featuredMetric: DbPlainFeaturedMetricWithParentTagName,
    correspondingRecord: ChartRecord
): string {
    return `${correspondingRecord.objectID}-fm-${featuredMetric.incomeGroup}-${slugify(featuredMetric.parentTagName)}`
}

function getGroupKey(
    featuredMetric: DbPlainFeaturedMetricWithParentTagName
): string {
    return `${featuredMetric.parentTagName}-${featuredMetric.incomeGroup}`
}

/**
 * Expands the array with FMs copied from the `default` group
 * for every income group that currently has zero FMs.
 *
 * 1. Copies keep the same `ranking`, `url`, `parentTagName`, etc.
 * 2. The original `default` FMs are removed from the result –
 *    they are never pushed to Algolia.
 */
function expandDefaultFeaturedMetrics(
    fms: DbPlainFeaturedMetricWithParentTagName[]
): ExpandedFeaturedMetric[] {
    const byTag = groupBy(fms, (fm) => fm.parentTagName)
    const expanded: ExpandedFeaturedMetric[] = fms.map((fm) => ({
        ...fm,
        // Confusing, because there are `default` FMs in this array currently,
        // but we filter them out once they're expanded.
        isIncomeGroupSpecificFM: true,
    }))

    for (const [_, featuredMetricsForTag] of Object.entries(byTag)) {
        const defaults = featuredMetricsForTag.filter(
            (fm) => fm.incomeGroup === FeaturedMetricIncomeGroup.Default
        )
        // If there are no defaults for this tag, there's nothing to expand
        if (defaults.length === 0) continue

        const presentGroups = new Set(
            featuredMetricsForTag
                .filter(
                    (fm) => fm.incomeGroup !== FeaturedMetricIncomeGroup.Default
                )
                .map((fm) => fm.incomeGroup)
        )

        for (const group of REAL_FM_INCOME_GROUPS) {
            if (presentGroups.has(group)) continue

            for (const fm of defaults) {
                expanded.push({
                    ...fm,
                    incomeGroup: group,
                    isIncomeGroupSpecificFM: false,
                })
            }
        }
    }

    // Drop the defaults. We only want income-group copies
    return expanded.filter(
        (fm) => fm.incomeGroup !== FeaturedMetricIncomeGroup.Default
    )
}

export async function createFeaturedMetricRecords(
    trx: KnexReadonlyTransaction,
    records: ChartRecord[]
): Promise<ChartRecord[]> {
    const featuredMetricsWithParentTagName =
        await getFeaturedMetricsByParentTagName(trx).then((fms) =>
            Object.values(fms).flat()
        )

    const expandedFeaturedMetrics = expandDefaultFeaturedMetrics(
        featuredMetricsWithParentTagName
    )

    const expandedFeaturedMetricsGroupedByTagAndIncomeGroup = groupBy(
        expandedFeaturedMetrics,
        getGroupKey
    )

    const featuredMetricRecords: ChartRecord[] = []

    for (const featuredMetric of expandedFeaturedMetrics) {
        const correspondingRecord = findMatchingRecordByPathnameAndQueryParams(
            records,
            featuredMetric
        )
        if (!correspondingRecord) {
            const error = `Featured metric "${featuredMetric.url}" not found in records`
            console.error(error)
            Sentry.captureException(error)
            continue
        }

        const score = calculateFeaturedMetricScore(
            featuredMetric,
            expandedFeaturedMetricsGroupedByTagAndIncomeGroup[
                getGroupKey(featuredMetric)
            ]
        )

        const availableEntities = filterAvailableEntities(
            featuredMetric,
            correspondingRecord.availableEntities
        )

        const objectID = generateObjectID(featuredMetric, correspondingRecord)

        featuredMetricRecords.push({
            ...correspondingRecord,
            isIncomeGroupSpecificFM: featuredMetric.isIncomeGroupSpecificFM,
            tags: [featuredMetric.parentTagName],
            objectID,
            availableEntities,
            originalAvailableEntities: correspondingRecord.availableEntities,
            score,
        })
    }

    return featuredMetricRecords
}

export function maybeAddChangeInPrefix(
    title?: string,
    shouldAddChangeInPrefix?: boolean
): string {
    if (!title) return ""
    return shouldAddChangeInPrefix
        ? "Change in " + lowerCaseFirstLetterUnlessAbbreviation(title)
        : title
}

export function toPlaintext(markdown: string): string {
    return new MarkdownTextWrap({
        text: markdown,
        fontSize: 10, // doesn't matter, but is a mandatory field
    }).plaintext
}
