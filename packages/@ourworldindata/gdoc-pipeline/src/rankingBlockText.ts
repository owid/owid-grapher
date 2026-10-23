import {
    EntityCode,
    LinkedRanking,
    LinkedRankings,
    RankingSortOrder,
} from "@ourworldindata/types"
import {
    ALL_COUNTRIES_PEER_GROUP_NAMES,
    computeRankSummary,
    defaultPeerGroupsForEntity,
    EnrichedBlockWithRankings,
    formatOrdinal,
    getEntityCodeFromChartUrl,
    getLinkedRanking,
    getRankingSpecsForBlock,
    RankingSpec,
    RankSummary,
    resolvePeerGroupCodes,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"

/**
 * Plain-text rendition of a ranking block (ranking-cards, peer-ranking,
 * peer-comparison) for the markdown and indexable-text exports. The values
 * come from the block's `linkedRankings`, so the text describes the entity
 * a profile was instantiated for, e.g.
 *   heading: "Germany at a glance"
 *   lines: ["Life expectancy: 81 years (30th highest of 229 countries, 2023)"]
 */
export interface RankingBlockText {
    heading?: string
    subheading?: string
    lines: string[]
}

const formatRank = (summary: RankSummary, sort: RankingSortOrder): string =>
    `${formatOrdinal(summary.rank)} ${sort} of ${summary.total}`

const formatPeerGroupName = (groupName: string): string =>
    ALL_COUNTRIES_PEER_GROUP_NAMES.some(
        (name) => name.toLowerCase() === groupName.trim().toLowerCase()
    )
        ? "all countries"
        : groupName

interface ResolvedRanking {
    spec: RankingSpec
    ranking: LinkedRanking
    entityCode: EntityCode
}

function resolveRankings(
    block: EnrichedBlockWithRankings,
    linkedRankings: LinkedRankings
): (ResolvedRanking | undefined)[] {
    return getRankingSpecsForBlock(block).map((spec) => {
        const ranking = getLinkedRanking(linkedRankings, spec)
        const entityCode = getEntityCodeFromChartUrl(spec.url)
        if (!ranking || !entityCode) return undefined
        return { spec, ranking, entityCode }
    })
}

/**
 * Returns undefined if the block has nothing to show, i.e. none of its
 * cards / indicators has a ranking with a row for the entity in its URL.
 * Cards / indicators without data are left out, as on the site.
 */
export function rankingBlockToText(
    block: EnrichedBlockWithRankings,
    linkedRankings: LinkedRankings
): RankingBlockText | undefined {
    const resolved = resolveRankings(block, linkedRankings)

    const text = match(block)
        .with({ type: "ranking-cards" }, (block): RankingBlockText => {
            const lines = block.cards.flatMap((card, i) => {
                const item = resolved[i]
                if (!item) return []
                const summary = computeRankSummary(
                    item.ranking,
                    item.entityCode,
                    card.sort
                )
                if (!summary) return []
                return [
                    `${card.title ?? item.ranking.title}: ${summary.row.formattedValue} (${formatRank(summary, card.sort)} countries, ${item.ranking.formattedTime})`,
                ]
            })
            return { heading: block.title, subheading: block.subtitle, lines }
        })
        .with({ type: "peer-ranking" }, (block): RankingBlockText => {
            const item = resolved[0]
            if (!item) return { lines: [] }
            const { ranking, entityCode } = item
            const worldSummary = computeRankSummary(
                ranking,
                entityCode,
                block.sort
            )
            if (!worldSummary) return { lines: [] }
            const groups = block.groups.length
                ? block.groups
                : defaultPeerGroupsForEntity(entityCode)
            const groupLines = groups.flatMap((group) => {
                const codes = resolvePeerGroupCodes(
                    group,
                    ranking.rows,
                    entityCode
                )
                const summary =
                    codes &&
                    computeRankSummary(ranking, entityCode, block.sort, codes)
                if (!summary) return []
                return [
                    `Among ${formatPeerGroupName(group)}: ${formatRank(summary, block.sort)}`,
                ]
            })
            return {
                heading: `${block.title ?? ranking.title}, ${ranking.formattedTime}`,
                lines: [
                    `Value: ${worldSummary.row.formattedValue}`,
                    ...new Set(groupLines),
                ],
            }
        })
        .with({ type: "peer-comparison" }, (block): RankingBlockText => {
            const lines = block.indicators.flatMap((indicator, i) => {
                const item = resolved[i]
                const row = item?.ranking.rows.find(
                    (row) => row.code === item.entityCode
                )
                if (!item || !row) return []
                return [
                    `${indicator.title ?? item.ranking.title}: ${row.formattedValue} (${item.ranking.formattedTime})`,
                ]
            })
            return { heading: block.title, lines }
        })
        .exhaustive()

    return text.lines.length > 0 ? text : undefined
}
