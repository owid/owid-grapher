/**
 * Type-level check that our DB type definitions match the actual DB schema.
 * `yarn typecheck` fails with a list of problems when they don't.
 *
 * dbSchema.generated.ts holds the schema as TS types, as mysql2 returns them
 * with our connection options; the db tests keep it up to date (see
 * schemaTypes.test.ts). This file compares each table's types against it:
 *
 * - Row types (what a SELECT returns) must have exactly the table's columns,
 *   with the same nullability. Their value types may be narrower or wider than
 *   the column's (e.g. `JsonString` for a JSON column, a TS enum for a VARCHAR,
 *   `string` for an ENUM), but not unrelated (e.g. `string` for a BIGINT).
 *   For an ENUM column, the row type must include every allowed value.
 * - Insert types may leave out columns that are nullable or have a default,
 *   and may be stricter than the DB, but must not allow anything the DB rejects:
 *   generated or unknown columns, NULL in a NOT NULL column, values outside an
 *   ENUM, or leaving out a column the DB requires.
 *
 * When this fails, fix the type definition (or the schema). If a mismatch is
 * deliberate, add it to `KnownMismatches` with the reason.
 */
import type { DbSchema } from "./dbSchema.generated.js"
import type {
    DbAdminApiKey,
    DbInsertArchivedChartVersion,
    DbInsertArchivedExplorerVersion,
    DbInsertArchivedMultiDimVersion,
    DbInsertArchivedPostVersion,
    DbInsertChart,
    DbInsertChartConfig,
    DbInsertChartDimension,
    DbInsertChartRevision,
    DbInsertChartSlugRedirect,
    DbInsertChartTag,
    DbInsertChartXEntity,
    DbInsertDataset,
    DbInsertDatasetTag,
    DbInsertDod,
    DbInsertDodLink,
    DbInsertDonor,
    DbInsertEntity,
    DbInsertExplorer,
    DbInsertExplorerChart,
    DbInsertExplorerVariable,
    DbInsertExplorerView,
    DbInsertExplorerViewDimensions,
    DbInsertFeaturedMetric,
    DbInsertFile,
    DbInsertImage,
    DbInsertJob,
    DbInsertMultiDimDataPage,
    DbInsertMultiDimRedirect,
    DbInsertMultiDimViewDimensions,
    DbInsertMultiDimXChartConfig,
    DbInsertNamespace,
    DbInsertNarrativeChart,
    DbInsertOrigin,
    DbInsertOriginsVariable,
    DbInsertPost,
    DbInsertPostGdoc,
    DbInsertPostGdocComponent,
    DbInsertPostGdocLink,
    DbInsertPostGdocTombstone,
    DbInsertPostGdocVariableFaq,
    DbInsertPostGdocXImage,
    DbInsertPostGdocXTag,
    DbInsertPostLink,
    DbInsertPostTag,
    DbInsertRedirect,
    DbInsertRelatedChart,
    DbInsertSlideshow,
    DbInsertSlideshowLink,
    DbInsertSlideshowXImage,
    DbInsertSource,
    DbInsertTag,
    DbInsertTagGraphNode,
    DbInsertTagVariableTopicTag,
    DbInsertUser,
    DbInsertVariable,
    DbPlainAnalyticsChartView,
    DbPlainAnalyticsGrapherView,
    DbPlainAnalyticsPageview,
    DbPlainArchivedChartVersion,
    DbPlainArchivedExplorerVersion,
    DbPlainArchivedMultiDimVersion,
    DbPlainArchivedPostVersion,
    DbPlainChart,
    DbPlainChartDimension,
    DbPlainChartSlugRedirect,
    DbPlainChartTag,
    DbPlainChartXEntity,
    DbPlainDataset,
    DbPlainDatasetTag,
    DbPlainDod,
    DbPlainDodLink,
    DbPlainDonor,
    DbPlainEntity,
    DbPlainExplorer,
    DbPlainExplorerChart,
    DbPlainExplorerVariable,
    DbPlainFeaturedMetric,
    DbPlainFile,
    DbPlainMultiDimDataPage,
    DbPlainMultiDimRedirect,
    DbPlainMultiDimXChartConfig,
    DbPlainNamespace,
    DbPlainNarrativeChart,
    DbPlainOriginVariable,
    DbPlainPostGdocLink,
    DbPlainPostGdocTombstone,
    DbPlainPostGdocVariableFaq,
    DbPlainPostGdocXImage,
    DbPlainPostGdocXTag,
    DbPlainPostLink,
    DbPlainPostTag,
    DbPlainRedirect,
    DbPlainRelatedChart,
    DbPlainSlideshow,
    DbPlainSlideshowLink,
    DbPlainSlideshowXImage,
    DbPlainTag,
    DbPlainTagGraphNode,
    DbPlainTagVariableTopicTag,
    DbPlainUser,
    DbRawChartConfig,
    DbRawChartRevision,
    DbRawExplorerView,
    DbRawImage,
    DbRawJob,
    DbRawOrigin,
    DbRawPost,
    DbRawPostGdoc,
    DbRawPostGdocComponent,
    DbRawSource,
    DbRawStaticViz,
    DbRawVariable,
} from "@ourworldindata/types"

/**
 * Our types for each table: `row` is what a `SELECT *` returns (the Raw type
 * if there is one, otherwise the Plain type), `insert` what we write. Leave one
 * out if we don't have a type for it.
 */
interface TableTypes {
    admin_api_keys: { row: DbAdminApiKey }
    analytics_chart_views: { row: DbPlainAnalyticsChartView }
    analytics_grapher_views: { row: DbPlainAnalyticsGrapherView }
    analytics_pageviews: { row: DbPlainAnalyticsPageview }
    archived_chart_versions: {
        row: DbPlainArchivedChartVersion
        insert: DbInsertArchivedChartVersion
    }
    archived_explorer_versions: {
        row: DbPlainArchivedExplorerVersion
        insert: DbInsertArchivedExplorerVersion
    }
    archived_multi_dim_versions: {
        row: DbPlainArchivedMultiDimVersion
        insert: DbInsertArchivedMultiDimVersion
    }
    archived_post_versions: {
        row: DbPlainArchivedPostVersion
        insert: DbInsertArchivedPostVersion
    }
    chart_configs: { row: DbRawChartConfig; insert: DbInsertChartConfig }
    chart_dimensions: {
        row: DbPlainChartDimension
        insert: DbInsertChartDimension
    }
    chart_revisions: { row: DbRawChartRevision; insert: DbInsertChartRevision }
    chart_slug_redirects: {
        row: DbPlainChartSlugRedirect
        insert: DbInsertChartSlugRedirect
    }
    chart_tags: { row: DbPlainChartTag; insert: DbInsertChartTag }
    charts: { row: DbPlainChart; insert: DbInsertChart }
    charts_x_entities: {
        row: DbPlainChartXEntity
        insert: DbInsertChartXEntity
    }
    dataset_tags: { row: DbPlainDatasetTag; insert: DbInsertDatasetTag }
    datasets: { row: DbPlainDataset; insert: DbInsertDataset }
    dod_links: { row: DbPlainDodLink; insert: DbInsertDodLink }
    dods: { row: DbPlainDod; insert: DbInsertDod }
    donors: { row: DbPlainDonor; insert: DbInsertDonor }
    entities: { row: DbPlainEntity; insert: DbInsertEntity }
    explorer_charts: {
        row: DbPlainExplorerChart
        insert: DbInsertExplorerChart
    }
    explorer_variables: {
        row: DbPlainExplorerVariable
        insert: DbInsertExplorerVariable
    }
    explorer_view_dimensions: { insert: DbInsertExplorerViewDimensions }
    explorer_views: { row: DbRawExplorerView; insert: DbInsertExplorerView }
    explorers: { row: DbPlainExplorer; insert: DbInsertExplorer }
    featured_metrics: {
        row: DbPlainFeaturedMetric
        insert: DbInsertFeaturedMetric
    }
    files: { row: DbPlainFile; insert: DbInsertFile }
    images: { row: DbRawImage; insert: DbInsertImage }
    jobs: { row: DbRawJob; insert: DbInsertJob }
    multi_dim_data_pages: {
        row: DbPlainMultiDimDataPage
        insert: DbInsertMultiDimDataPage
    }
    multi_dim_redirects: {
        row: DbPlainMultiDimRedirect
        insert: DbInsertMultiDimRedirect
    }
    multi_dim_view_dimensions: { insert: DbInsertMultiDimViewDimensions }
    multi_dim_x_chart_configs: {
        row: DbPlainMultiDimXChartConfig
        insert: DbInsertMultiDimXChartConfig
    }
    namespaces: { row: DbPlainNamespace; insert: DbInsertNamespace }
    narrative_charts: {
        row: DbPlainNarrativeChart
        insert: DbInsertNarrativeChart
    }
    origins: { row: DbRawOrigin; insert: DbInsertOrigin }
    origins_variables: {
        row: DbPlainOriginVariable
        insert: DbInsertOriginsVariable
    }
    post_tags: { row: DbPlainPostTag; insert: DbInsertPostTag }
    posts: { row: DbRawPost; insert: DbInsertPost }
    posts_gdocs: { row: DbRawPostGdoc; insert: DbInsertPostGdoc }
    posts_gdocs_components: {
        row: DbRawPostGdocComponent
        insert: DbInsertPostGdocComponent
    }
    posts_gdocs_links: {
        row: DbPlainPostGdocLink
        insert: DbInsertPostGdocLink
    }
    posts_gdocs_tombstones: {
        row: DbPlainPostGdocTombstone
        insert: DbInsertPostGdocTombstone
    }
    posts_gdocs_variables_faqs: {
        row: DbPlainPostGdocVariableFaq
        insert: DbInsertPostGdocVariableFaq
    }
    posts_gdocs_x_images: {
        row: DbPlainPostGdocXImage
        insert: DbInsertPostGdocXImage
    }
    posts_gdocs_x_tags: {
        row: DbPlainPostGdocXTag
        insert: DbInsertPostGdocXTag
    }
    posts_links: { row: DbPlainPostLink; insert: DbInsertPostLink }
    redirects: { row: DbPlainRedirect; insert: DbInsertRedirect }
    related_charts: { row: DbPlainRelatedChart; insert: DbInsertRelatedChart }
    slideshow_links: {
        row: DbPlainSlideshowLink
        insert: DbInsertSlideshowLink
    }
    slideshow_x_images: {
        row: DbPlainSlideshowXImage
        insert: DbInsertSlideshowXImage
    }
    slideshows: { row: DbPlainSlideshow; insert: DbInsertSlideshow }
    sources: { row: DbRawSource; insert: DbInsertSource }
    static_viz: { row: DbRawStaticViz }
    tag_graph: { row: DbPlainTagGraphNode; insert: DbInsertTagGraphNode }
    tags: { row: DbPlainTag; insert: DbInsertTag }
    tags_variables_topic_tags: {
        row: DbPlainTagVariableTopicTag
        insert: DbInsertTagVariableTopicTag
    }
    users: { row: DbPlainUser; insert: DbInsertUser }
    variables: { row: DbRawVariable; insert: DbInsertVariable }
}

/** Tables we deliberately have no types for */
type UntypedTables =
    | "_test_db_ready" // only exists in the db test database
    | "migrations" // TypeORM's own bookkeeping
    | "chart_diff_approvals" // only used by the ETL's chart review
    | "chart_diff_conflicts" // only used by the ETL's chart review
    | "explorer_tags" // only accessed with raw SQL
    | "importer_additionalcountryinfo" // deprecated

/**
 * Mismatches we accept, keyed by `table.column`, with the reason as the value.
 * The check fails if an entry here no longer matches a problem, so the list
 * can't go stale.
 */
interface KnownMismatches {
    // Nullable in the DB, but never NULL and always written. Could be made
    // NOT NULL in the DB.
    "archived_chart_versions.manifest": "never NULL in practice"
    "archived_explorer_versions.manifest": "never NULL in practice"
    "archived_multi_dim_versions.manifest": "never NULL in practice"
    "archived_post_versions.manifest": "never NULL in practice"
    "explorers.commitMessage": "never NULL in practice"
    "explorers.lastEditedAt": "never NULL in practice"
    "explorers.lastEditedByUserId": "never NULL in practice"
    "featured_metrics.incomeGroup": "never NULL in practice; defaults to 'default'"
    "posts_gdocs_components.config": "never NULL in practice"
    "posts_gdocs_components.gdocId": "never NULL in practice"
    "posts_gdocs_components.parent": "never NULL in practice"
    "posts_gdocs_components.path": "never NULL in practice"
    "posts_gdocs_links.sourceId": "never NULL in practice"
    "posts_gdocs_tombstones.gdocId": "never NULL in practice"
    "related_charts.updatedAt": "never NULL in practice"

    // Generated columns that are typed optional instead of nullable. Making
    // them `| null` needs changes throughout the gdoc model.
    "posts_gdocs.authors": "null when content has no authors, typed as undefined"
    "posts_gdocs.type": "null when content has no type, typed as undefined"
    // Generated from the TSV, which can never be NULL
    "explorers.isPublished": "generated from tsv, never NULL"

    // upsertExplorer derives the config from the TSV
    "explorers.config": "computed by upsertExplorer, not passed in"

    // JSON columns typed as the parsed object, though they come back as
    // strings. The models (de)serialize them by hand; this should be split
    // into Raw and Enriched types.
    "jobs.payload": "JSON column typed as the parsed payload"
    "slideshows.config": "JSON column typed as the parsed config"
}

// --- Implementation ---

interface Problem<
    Table extends string,
    Column extends string,
    Description extends string,
> {
    key: `${Table}.${Column}`
    problem: Description
}

/** Turns string enums into their literal values, so they compare with ENUMs */
type Normalize<T> = T extends string ? `${T}` : T

type IsLiteralStringUnion<T> = [T] extends [string]
    ? string extends T
        ? false
        : true
    : false

type IsOptionalKey<T, K extends keyof T> = {} extends Pick<T, K> ? true : false

type Columns<T> = Extract<keyof T, string>

type ValuesOf<T> = T[keyof T]

/** Problems with a TS row type `R` for a table with schema row type `S` */
type RowProblems<Table extends string, R, S> =
    | ValuesOf<{
          [K in Exclude<Columns<S>, keyof R>]: Problem<
              Table,
              K,
              "column is missing from the row type"
          >
      }>
    | ValuesOf<{
          [K in Exclude<Columns<R>, keyof S>]: Problem<
              Table,
              K,
              "row type has a property that isn't a column"
          >
      }>
    | ValuesOf<{
          [K in Columns<R> & Columns<S>]: RowValueProblem<Table, K, R[K], S[K]>
      }>

type RowValueProblem<
    Table extends string,
    Column extends string,
    TsType,
    DbType,
> = undefined extends TsType
    ? Problem<Table, Column, "row type allows undefined, but rows never do">
    : null extends DbType
      ? null extends TsType
          ? RowValueTypeProblem<Table, Column, TsType, DbType>
          : Problem<Table, Column, "column is nullable, but the row type isn't">
      : null extends TsType
        ? Problem<Table, Column, "row type is nullable, but the column isn't">
        : RowValueTypeProblem<Table, Column, TsType, DbType>

type RowValueTypeProblem<
    Table extends string,
    Column extends string,
    TsType,
    DbType,
    Ts = Normalize<Exclude<TsType, null>>,
    Db = Exclude<DbType, null>,
> =
    IsLiteralStringUnion<Db> extends true
        ? [Db] extends [Ts]
            ? never
            : Problem<
                  Table,
                  Column,
                  "row type doesn't include every value of the ENUM column"
              >
        : [Ts] extends [Db]
          ? never
          : [Db] extends [Ts]
            ? never
            : Problem<
                  Table,
                  Column,
                  "row type doesn't match the column's type"
              >

/** Problems with a TS insert type `I` for a table with schema insert type `S` */
type InsertProblems<Table extends string, I, S> =
    | ValuesOf<{
          [K in Exclude<Columns<S>, keyof I>]: IsOptionalKey<S, K> extends true
              ? never
              : Problem<
                    Table,
                    K,
                    "column is required, but missing from the insert type"
                >
      }>
    | ValuesOf<{
          [K in Exclude<Columns<I>, keyof S>]: Problem<
              Table,
              K,
              "insert type has a property that isn't an insertable column (missing or generated)"
          >
      }>
    | ValuesOf<{
          [K in Columns<I> & Columns<S>]: InsertValueProblem<
              Table,
              K,
              I,
              S,
              K
          >
      }>

type InsertValueProblem<
    Table extends string,
    Column extends string,
    I,
    S,
    K extends keyof I & keyof S,
    Ts = Normalize<Exclude<I[K], undefined>>,
    Db = Exclude<S[K], undefined>,
> =
    | (IsOptionalKey<I, K> extends true
          ? IsOptionalKey<S, K> extends true
              ? never
              : Problem<
                    Table,
                    Column,
                    "insert type has it optional, but the column is required"
                >
          : never)
    | ([Ts] extends [Db]
          ? never
          : null extends Ts
            ? null extends Db
                ? Problem<
                      Table,
                      Column,
                      "insert type allows values the column doesn't"
                  >
                : Problem<
                      Table,
                      Column,
                      "insert type allows null, but the column is NOT NULL"
                  >
            : Problem<
                  Table,
                  Column,
                  "insert type allows values the column doesn't"
              >)

type TableProblems<T extends keyof TableTypes & keyof DbSchema> =
    | (TableTypes[T] extends { row: infer R }
          ? RowProblems<T, R, DbSchema[T]["row"]>
          : never)
    | (TableTypes[T] extends { insert: infer I }
          ? InsertProblems<T, I, DbSchema[T]["insert"]>
          : never)

type AllProblems =
    | ValuesOf<{
          [T in keyof TableTypes & keyof DbSchema]: TableProblems<T>
      }>
    | ValuesOf<{
          [T in Exclude<keyof DbSchema, keyof TableTypes | UntypedTables>]: {
              key: T
              problem: "table has no types; add it to TableTypes or UntypedTables"
          }
      }>
    | ValuesOf<{
          [T in Exclude<keyof TableTypes | UntypedTables, keyof DbSchema>]: {
              key: T
              problem: "not a table in the schema"
          }
      }>

type StaleKnownMismatches = ValuesOf<{
    [K in Exclude<keyof KnownMismatches, AllProblems["key"]>]: {
        key: K
        problem: "listed in KnownMismatches, but no longer a mismatch"
    }
}>

type RemainingProblems =
    | Exclude<AllProblems, { key: keyof KnownMismatches }>
    | StaleKnownMismatches

type ToMessage<P> = P extends {
    key: infer Key extends string
    problem: infer Description extends string
}
    ? `${Key}: ${Description}`
    : never

// Wrapped in a template literal so errors print the messages instead of the alias name
type ProblemMessages = `${ToMessage<RemainingProblems>}`

// If this line errors, the error lists the problems; see the comment at the top.
// (db/tsconfig.json sets noErrorTruncation so the list isn't cut off.)
export const dbTypesMatchSchema: [ProblemMessages] extends [never]
    ? true
    : `${ProblemMessages}` = true as const
