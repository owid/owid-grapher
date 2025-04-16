import {
    countries,
    DbPlainFeaturedMetricWithParentTagName,
    FeaturedMetricIncomeGroup,
    groupBy,
    orderBy,
    removeTrailingParenthetical,
    slugify,
    Url,
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
import {
    countriesByName,
    incomeGroupsByName,
} from "@ourworldindata/utils/dist/regions.js"
import urljoin from "url-join"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { incomeGroupMap } from "./types.js"

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
    return orderBy(
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
                ? "explorer"
                : "grapher",
            record.slug,
            record.queryParams ?? ""
        )
    )
}

function findMatchingRecordBySlugAndQueryParams(
    records: ChartRecord[],
    featuredMetric: DbPlainFeaturedMetricWithParentTagName
) {
    const fmUrl = Url.fromURL(featuredMetric.url)
    return records.find((record) => {
        if (record.slug !== fmUrl.slug) return false
        const recordUrl = createRecordUrl(record)
        return fmUrl.areQueryParamsEqual(recordUrl)
    })
}

/**
 * All featured metrics start at a score of 11000, which places them above all other records
 * in the `explorer-views-and-charts` index.
 * The score is then adjusted based on the ranking of the featured metric within its group.
 * Featured Metrics for the "all" income group are also given a boost to make sure they
 * show before the other income groups.
 */
function calculateFeaturedMetricScore(
    featuredMetric: DbPlainFeaturedMetricWithParentTagName,
    group: DbPlainFeaturedMetricWithParentTagName[]
): number {
    let score = 11000
    // If there are 3 FMs in the group, rank 1 gets 3 points, rank 2 gets 2 points, rank 3 gets 1 point.
    // This means we can sort by desc(score) in Algolia and they'll show up according to their rank.
    score += group.length - featuredMetric.ranking

    if (featuredMetric.incomeGroup === FeaturedMetricIncomeGroup.All) {
        score += 100
    }

    return score
}

/**
 * FeaturedMetricIncomeGroup.Low -> { name: 'OWID_LIC', members: ["AFG", "BFA", "BDI", etc..] }
 */
function getCorrespondingIncomeGroup(
    incomeGroupName: FeaturedMetricIncomeGroup
) {
    const owidIncomeGroupName =
        incomeGroupMap[
            incomeGroupName as Exclude<
                FeaturedMetricIncomeGroup,
                FeaturedMetricIncomeGroup.All
            >
        ]

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
    const shouldFilterAvailableEntities =
        featuredMetric.incomeGroup !== FeaturedMetricIncomeGroup.All
    if (!shouldFilterAvailableEntities) return availableEntities

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

export async function createFeaturedMetricRecords(
    trx: KnexReadonlyTransaction,
    records: ChartRecord[]
): Promise<ChartRecord[]> {
    const featuredMetricsWithParentTagName =
        await getFeaturedMetricsByParentTagName(trx).then((fms) =>
            Object.values(fms).flat()
        )

    const featuredMetricsGroupedByTagAndIncomeGroup = groupBy(
        featuredMetricsWithParentTagName,
        getGroupKey
    )

    const featuredMetricRecords: ChartRecord[] = []

    for (const featuredMetric of featuredMetricsWithParentTagName) {
        const correspondingRecord = findMatchingRecordBySlugAndQueryParams(
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
            featuredMetricsGroupedByTagAndIncomeGroup[
                getGroupKey(featuredMetric)
            ]
        )

        const availableEntities = filterAvailableEntities(
            featuredMetric,
            correspondingRecord.availableEntities
        )

        const objectID = generateObjectID(featuredMetric, correspondingRecord)

        const featuredMetricRecord: ChartRecord = {
            ...correspondingRecord,
            tags: [featuredMetric.parentTagName],
            objectID,
            availableEntities,
            originalAvailableEntities: correspondingRecord.availableEntities,
            score,
        }

        featuredMetricRecords.push(featuredMetricRecord)
    }

    return featuredMetricRecords
}
