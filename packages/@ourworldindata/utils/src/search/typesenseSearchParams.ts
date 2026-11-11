// Query-side Typesense settings that mirror the Algolia index settings in
// baker/algolia/configureAlgolia.ts.
//
// The two engines split this configuration differently: Algolia stores
// `searchableAttributes` (whose order *is* the attribute ranking) and
// `customRanking` on the index, while Typesense takes the equivalents as query
// parameters. So what lives in configureAlgolia.ts over there lives here.

/**
 * The charts collection's searchable fields, mirroring Algolia's
 * `searchableAttributes` in the same order. Weight and typo tolerance are
 * declared alongside each field so the three comma-separated lists Typesense
 * wants can't drift out of alignment.
 *
 * `weight` — Algolia demotes `tags`, `subtitle` and the entity lists via
 * `disableExactOnAttributes`, so a match there doesn't count towards its `exact`
 * ranking criterion. Typesense has no direct equivalent, so those fields get low
 * weights instead; with `text_match_type: "max_weight"` a title match reliably
 * outranks an entity match.
 *
 * `typos` — Typesense's `num_typos` defaults to 2 *per field*, and on the entity
 * lists that is actively harmful, because every country chart carries ~200 short
 * country names for a fuzzy match to land on:
 *
 *   - "malaria worldwide" matched 7 charts about anything but malaria, because
 *     "malaria" is 2 edits from both "Malawi" and "Malaysia" — while "worldwide"
 *     matched a title, a subtitle, or a data producer actually named
 *     "Worldwide". That killed the closest-matches fallback (there were
 *     "results"), and it was the single largest regression in the evaluation.
 *   - "japaj" matched 7,842 documents, none of them about Japan.
 *
 * Setting 0 there costs nothing measurable — entity matching is for exact terms
 * like "refrigerator" or "bananas" — and both cases above collapse to sane
 * numbers (0 and 7 respectively).
 *
 * `availableEntities` is emphatically NOT just a country list, and it must stay
 * searchable. For a large class of charts the entity dimension *is* the subject
 * matter — household technologies, ocean-waste items, food products — and there
 * it is the only field containing the term. Dropping it made "refrigerator",
 * "washing machine", "dishwasher" and "cigarette butts" return nothing at all,
 * and cut "bananas" from 103 matches to 21.
 */
const CHARTS_FIELDS = [
    { field: "title", weight: 10, typos: 2 },
    { field: "containerTitle", weight: 9, typos: 2 },
    { field: "slug", weight: 8, typos: 2 },
    { field: "variantName", weight: 7, typos: 2 },
    { field: "subtitle", weight: 3, typos: 2 },
    { field: "tags", weight: 4, typos: 2 },
    { field: "availableEntities", weight: 1, typos: 0 },
    { field: "originalAvailableEntities", weight: 1, typos: 0 },
    { field: "datasetProducers", weight: 5, typos: 0 },
] as const

export const CHARTS_QUERY_BY = CHARTS_FIELDS.map((f) => f.field).join(",")
export const CHARTS_QUERY_BY_WEIGHTS = CHARTS_FIELDS.map((f) => f.weight).join(
    ","
)
export const CHARTS_NUM_TYPOS = CHARTS_FIELDS.map((f) => f.typos).join(",")

/**
 * The closest thing Typesense has to Algolia's `attribute` ranking criterion,
 * and the single most important setting here.
 *
 * `text_match_type` defaults to `max_score`, which ranks on how *well* the best
 * field matched and treats the field's weight as a minor tie-breaker. That
 * loses the distinction Algolia makes between "matched in the title" and
 * "matched in a tag": Typesense would score a chart that matched one token in
 * its title and one in its tags the same as one that matched both in its title,
 * and the popularity `score` then decided. Searching "energy consumption"
 * returned land-use charts, which match "use" (via the `energy use` synonym) in
 * their title and "energy" in an `Energy and Environment` tag.
 *
 * `max_weight` promotes the best-matching field's *weight* to the dominant
 * component, so `query_by_weights` above behaves like Algolia's ordered
 * `searchableAttributes`.
 *
 * `prioritize_num_matching_fields` defaults to true and boosts documents that
 * match across more fields — Algolia has no such rule, and it actively rewards
 * exactly the scattered cross-field matches described above.
 *
 * Measured over 16 queries against Algolia's top 5: 41/80 → 50/80. "energy
 * consumption" went 0/5 → 4/5 and "renewable energy" 0/5 → 3/5.
 */
export const TYPESENSE_RELEVANCE_PARAMS = {
    text_match_type: "max_weight",
    prioritize_num_matching_fields: false,
    // Prefix-match the last query token, which is Typesense's default and also
    // Algolia's. We previously set this false, reasoning from Algolia's
    // `disablePrefixOnAttributes` — but that only disables prefixing on the
    // named attributes, it doesn't turn the feature off. With it off, a
    // truncated final word finds nothing: "bans on bullfightin" returned
    // nothing while Algolia rescued it, even though "bullfighting" matches two
    // charts.
    prefix: true,
} as const

/**
 * Algolia's `customRanking` for the charts index: desc(score),
 * asc(viewTitleIndexWithinExplorer), asc(titleLength).
 *
 * `_text_match(buckets: 8)` is what makes those tie-breakers matter. Typesense's
 * raw `_text_match` is so fine-grained that it almost never ties, which would
 * leave the custom ranking dead code; bucketing groups comparable relevance
 * scores together so the tie-breakers decide within a bucket — the same shape as
 * Algolia's tiered ranking criteria. Unbucketed measured clearly worse (45/80).
 *
 * The exact bucket count barely matters once `max_weight` is in play: anything
 * from 5 to 12 scored 48–50/80, because the relevance signal is already
 * dominated by field weight rather than by fine score differences. 8 sits in
 * the middle of that flat region — it is not a tuned value.
 *
 * Typesense allows at most 3 sort fields, one short of what the Algolia ranking
 * needs, so the last two are folded into the precomputed `rankTiebreaker` field
 * (see `computeRankTiebreaker` in the indexer) — which sorts identically to
 * `viewTitleIndexWithinExplorer:asc, titleLength:asc`.
 */
export const CHARTS_SORT_BY = [
    "_text_match(buckets: 8):desc",
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
export const PAGES_QUERY_BY_RESTRICTED = [
    "title",
    "excerpt",
    "tags",
    "authors",
].join(",")

export const PAGES_QUERY_BY_RESTRICTED_WEIGHTS = [10, 8, 5, 6].join(",")

/** Algolia's `customRanking` for the pages index: desc(score), desc(importance). */
export const PAGES_SORT_BY = [
    "_text_match(buckets: 8):desc",
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
