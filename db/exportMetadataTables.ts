// Classification of database tables for the public metadata export
// (exportMetadata.ts). Kept in a separate module (without side effects) so
// that the db test suite can verify that every table created by our
// migrations is classified here.
//
// Every table falls into exactly one tier:
//   - PUBLIC_DATA_TABLES: structure + data ship in the public owid_metadata
//     dump (downloaded by anyone running the stack locally).
//   - PRIVATE_DATA_TABLES: structure ships in the public dump, but the data
//     is sensitive/internal and travels only in the private sidecar dump
//     (exportPrivateData.ts → r2:owid-private). Never published.
//   - SCHEMA_ONLY_TABLES: structure ships publicly, data goes nowhere.
//   - USERS_TABLE: exported publicly with anonymised data.
//
// Keep every list alphabetised.

export const PUBLIC_DATA_TABLES = [
    "analytics_popularity",
    "archived_chart_versions",
    "archived_explorer_versions",
    "archived_multi_dim_versions",
    "archived_post_versions",
    "chart_configs",
    "chart_diff_approvals",
    "chart_diff_conflicts",
    "chart_dimensions",
    "chart_revisions",
    "chart_slug_redirects",
    "chart_tags",
    "charts_x_entities",
    "charts",
    "dataset_tags",
    "datasets",
    "dod_links",
    "dods",
    "entities",
    "explorer_charts",
    "explorer_tags",
    "explorer_variables",
    "explorer_view_dimensions",
    "explorer_views",
    "explorers",
    "featured_metrics",
    "files",
    "housekeeper_reviews",
    "images",
    "importer_additionalcountryinfo",
    "jobs",
    "migrations",
    "multi_dim_data_pages",
    "multi_dim_redirects",
    "multi_dim_view_dimensions",
    "multi_dim_x_chart_configs",
    "namespaces",
    "narrative_charts",
    "origins_variables",
    "origins",
    "post_tags",
    "posts_gdocs_components",
    "posts_gdocs_links",
    "posts_gdocs_tombstones",
    "posts_gdocs_variables_faqs",
    "posts_gdocs_x_images",
    "posts_gdocs_x_tags",
    "posts_gdocs",
    "posts_links",
    "posts",
    "redirects",
    "related_charts",
    "slideshow_links",
    "slideshow_x_images",
    "slideshows",
    "sources",
    "static_viz",
    "tag_graph",
    "tags_variables_topic_tags",
    "tags",
    "variables",
]

// Tables whose structure is public but whose data is sensitive/internal and
// therefore only travels in the private sidecar dump (exportPrivateData.ts),
// uploaded to r2:owid-private and imported by staging servers and devs-with-
// access via `make refresh.private`. exportPrivateData.ts dumps exactly this
// list, so it stays the single source of truth. Keep alphabetised.
export const PRIVATE_DATA_TABLES = [
    // Hashed admin API keys — authentication material that must never appear
    // in the public dump. Staging needs the rows so ETL can authenticate
    // against the staging admin API with the shared ADMIN_API_KEY.
    "admin_api_keys",
    // The analytics_* tables are internal and large; their per-page/per-chart
    // view counts ship only here. Populated on prod by the analytics service
    // (`ana bigquery-to-mysql` in owid/analytics).
    // (analytics_popularity is also analytics-owned, but it's whitelisted in
    // PUBLIC_DATA_TABLES with data, so it doesn't need to travel here.)
    "analytics_chart_views",
    "analytics_grapher_views",
    "analytics_pageviews",
    // Internal staff comments on charts/indicators/multi-dims. The discussion
    // is not for public dumps, but staging servers and devs-with-access should
    // see it — the commenting tool is aimed at exactly those environments.
    "comments",
]

// Tables that are intentionally schema-only: their structure ships publicly
// but their data is exported nowhere. Listing them here (rather than relying
// on a default) documents *why* they're excluded and lets the classification
// check confirm every table has been considered. Keep alphabetised.
export const SCHEMA_ONLY_TABLES = [
    "donors", // donor PII
]

// The users table is exported with anonymised data (see anonymisedUsersSql
// in exportMetadata.ts).
export const USERS_TABLE = "users"

export function findUnclassifiedTables(allTables: string[]): string[] {
    const classified = new Set([
        ...PUBLIC_DATA_TABLES,
        ...PRIVATE_DATA_TABLES,
        ...SCHEMA_ONLY_TABLES,
        USERS_TABLE,
    ])
    return allTables.filter((t) => !classified.has(t))
}

export function unclassifiedTablesErrorMessage(unclassified: string[]): string {
    return (
        `the following tables are not classified in PUBLIC_DATA_TABLES, ` +
        `PRIVATE_DATA_TABLES or SCHEMA_ONLY_TABLES: ${unclassified.join(
            ", "
        )}.\nAdd each one to exactly one of those lists in ` +
        `db/exportMetadataTables.ts (data is exported publicly only for ` +
        `tables in PUBLIC_DATA_TABLES; PRIVATE_DATA_TABLES data travels in ` +
        `the private sidecar dump, see db/exportPrivateData.ts).`
    )
}
