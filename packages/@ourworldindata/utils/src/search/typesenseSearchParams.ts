// Query-side Typesense settings that mirror the Algolia index settings in
// baker/algolia/configureAlgolia.ts.
//
// The two engines split this configuration differently: Algolia stores
// `searchableAttributes` (whose order *is* the attribute ranking) and
// `customRanking` on the index, while Typesense takes the equivalents as query
// parameters. So what lives in configureAlgolia.ts over there lives here.

/**
 * Algolia's `searchableAttributes` for the charts index, in the same order —
 * minus `availableEntities` and `originalAvailableEntities`.
 *
 * Those two are deliberately excluded. Typesense counts a query token as
 * matched no matter which queried field it hit, so with entities searchable, a
 * chart titled "COVID-19 vaccination coverage worldwide" matches the query
 * "malaria worldwide" — "worldwide" from the title, "malaria" from an entity
 * name (entity lists include causes of death). Algolia returns nothing for that
 * query, which is the behaviour the "closest matches" fallback is built around.
 *
 * The cost is that typing a country name into the free-text box no longer
 * matches charts through their entity list. In practice the UI turns recognised
 * country names into filters, which are applied via `filter_by` on
 * `availableEntities` — see `formatCountryFilterBy`.
 */
export const CHARTS_QUERY_BY = [
    "title",
    "containerTitle",
    "slug",
    "variantName",
    "subtitle",
    "tags",
    "datasetProducers",
].join(",")

/**
 * Algolia demotes `tags` and `subtitle` via `disableExactOnAttributes` — a match
 * there doesn't count towards the `exact` ranking criterion. Typesense has no
 * direct equivalent, so those fields get low weights instead.
 */
export const CHARTS_QUERY_BY_WEIGHTS = [
    10, // title
    9, // containerTitle
    8, // slug
    7, // variantName
    3, // subtitle
    4, // tags
    5, // datasetProducers
].join(",")

/**
 * Algolia's `customRanking` for the charts index: desc(score),
 * asc(viewTitleIndexWithinExplorer), asc(titleLength).
 *
 * `_text_match(buckets: 3)` is what makes those tie-breakers matter. Typesense's
 * raw `_text_match` is so fine-grained that it almost never ties, which would
 * leave the custom ranking dead code; bucketing groups comparable relevance
 * scores together so the tie-breakers decide within a bucket — the same shape as
 * Algolia's coarse, tiered ranking criteria.
 *
 * 3 buckets rather than 10: on a 12-query spot check against Algolia, coarser
 * bucketing (i.e. letting the popularity `score` outweigh small relevance
 * differences, as Algolia's tiers do) matched Algolia noticeably more often —
 * 30/60 top-5 hits vs 24/60 at 10 buckets and 22/60 unbucketed. That sample is
 * too small to treat as tuned; it only says "coarse beats fine" here.
 *
 * Typesense allows at most 3 sort fields, one short of what the Algolia ranking
 * needs, so the last two are folded into the precomputed `rankTiebreaker` field
 * (see `computeRankTiebreaker` in the indexer) — which sorts identically to
 * `viewTitleIndexWithinExplorer:asc, titleLength:asc`.
 */
export const CHARTS_SORT_BY = [
    "_text_match(buckets: 3):desc",
    "score:desc",
    "rankTiebreaker:asc",
].join(",")

/** Algolia's `searchableAttributes` for the pages index, in the same order. */
export const PAGES_QUERY_BY = [
    "title",
    "excerpt",
    "tags",
    "authors",
    "content",
].join(",")

/**
 * `content` is heavily demoted: Algolia disables exact matching, typo tolerance
 * and prefix matching on it so that a body-text-only match ranks below a title
 * match (and "corn" doesn't match "corner").
 */
export const PAGES_QUERY_BY_WEIGHTS = [
    10, // title
    8, // excerpt
    5, // tags
    6, // authors
    2, // content
].join(",")

/**
 * Used when a country filter is active: don't search page *content*, so we
 * don't return articles that merely mention a country without being about it
 * ("Unlike Germany…"). The Algolia equivalent is `restrictSearchableAttributes`.
 */
export const PAGES_QUERY_BY_RESTRICTED = ["title", "excerpt", "tags", "authors"]
    .join(",")

export const PAGES_QUERY_BY_RESTRICTED_WEIGHTS = [10, 8, 5, 6].join(",")

/** Algolia's `customRanking` for the pages index: desc(score), desc(importance). */
export const PAGES_SORT_BY = [
    "_text_match(buckets: 3):desc",
    "score:desc",
    "importance:desc",
].join(",")

/**
 * Name of the stopword set uploaded to Typesense by the indexer. Algolia does
 * this with `removeStopWords: ["en"]` as an index setting; Typesense needs the
 * set to exist server-side and to be named in each query.
 */
export const TYPESENSE_STOPWORDS_SET = "english"

/**
 * Name of the synonym set uploaded by baker/typesense/configureTypesense.ts.
 * Algolia stores synonyms per index; Typesense 30 stores them in named global
 * sets that each query opts into.
 */
export const TYPESENSE_SYNONYM_SET = "owid"
