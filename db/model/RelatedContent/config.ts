import { RelatedContentType } from "./types.js"

export interface SignalWeights {
    tagIdf: number
    varOverlap: number
    embedding: number
    quality: number
    recency: number
}

export interface TypeQuotas {
    minTopicPage: number
    minDataInsight: number
    maxGrapher: number
    maxArticle: number
    maxDataInsight: number
    maxTopicPage: number
}

// Caps applied to the *collapsed* top-N slice of the list (the items the
// user sees before clicking "Show more"). Encodes the editorial mix:
// indicator-heavy with at most a handful of other types so the visible
// preview reads as "more data" rather than a mixed link dump.
export interface TopNComposition {
    maxGrapher: number
    maxDataInsight: number
    // Combined cap for article + topic-page in the top-N slice.
    maxArticleAndTopicPage: number
}

export interface RelatedContentConfig {
    listSize: number
    candidatePoolSize: number
    // Items visible before the "Show more" expansion. Must be ≤ listSize.
    collapsedSize: number
    // Number of grapher items forced into the leading positions (after
    // any pinned items). Drives the "lead with 2 indicators" rule.
    leadGrapherCount: number
    topNComposition: TopNComposition
    weights: SignalWeights
    typeBonus: Record<RelatedContentType, number>
    quotas: TypeQuotas
    recencyHalfLifeDays: number
    embeddingModel: string
}

/**
 * Allowlist of grapher slugs for which the related-content pipeline runs at bake time.
 * Why: scopes the metadata-onion experiment rollout to a known list and avoids running
 * the pipeline (and its DB cost) for ~6,000 data pages until perf is dialed in.
 * To disable the gate, replace with `null` in the bake call site.
 */
export const ENABLED_SLUGS: ReadonlySet<string> = new Set([
    "gdp-per-capita-maddison-project-database",
    "democracy-index-eiu",
    "gdp-per-capita-worldbank",
    "life-expectancy",
    "co-emissions-per-capita",
    "children-per-woman-un",
    "human-development-index",
    "economic-inequality-gini-index",
    "population",
    "population-with-un-projections",
    "mean-years-of-schooling-long-run",
    "annual-co2-emissions-per-country",
    "population-density",
    "per-capita-energy-use",
    "deaths-in-armed-conflicts-by-type",
])

/**
 * Slugs of multi-indicator grapher charts that we force to render as data pages
 * (bypassing the single-Y-indicator gate in getDatapageIndicatorId). The metadata
 * onion renders an indicator switcher when more than one indicator is present.
 *
 * Used as an experiment vehicle for the multi-indicator data-page rollout.
 */
export const FORCE_DATAPAGE_SLUGS: ReadonlySet<string> = new Set([
    "global-primary-energy",
    "electricity-prod-source-stacked",
    "causes-of-death-in-children-under-5",
    "annual-number-of-deaths-by-cause",
    "global-energy-substitution",
    "deaths-in-armed-conflicts-by-type",
    "fossil-fuel-consumption-by-type",
])

export const DEFAULT_CONFIG: RelatedContentConfig = {
    listSize: 15,
    candidatePoolSize: 200,
    collapsedSize: 5,
    leadGrapherCount: 2,
    topNComposition: {
        maxGrapher: 3,
        maxDataInsight: 1,
        maxArticleAndTopicPage: 2,
    },
    weights: {
        tagIdf: 1.0,
        varOverlap: 0,
        embedding: 1.5,
        quality: 0.5,
        recency: 0.3,
    },
    // Boost graphers so they tend to rise to the top; mild boost for
    // topic pages (they're useful entry points to broader exploration);
    // small demote for data insights to avoid them crowding out indicators.
    typeBonus: {
        "topic-page": 0.1,
        article: 0,
        "data-insight": -0.05,
        grapher: 0.4,
    },
    quotas: {
        minTopicPage: 1,
        minDataInsight: 0,
        maxGrapher: 8,
        maxArticle: 4,
        maxDataInsight: 2,
        maxTopicPage: 3,
    },
    recencyHalfLifeDays: 365,
    embeddingModel: "text-embedding-3-small",
}
