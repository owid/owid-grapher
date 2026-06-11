// Classification of database tables for the public metadata export
// (exportMetadata.ts). Kept in a separate module (without side effects) so
// that the db test suite can verify that every table created by our
// migrations is classified here.
//
// By default, only each table's structure is exported, with no rows.
// For data to be exported, it must be explicitly included in the
// INCLUDE_DATA_TABLES list. Keep both lists alphabetised.

export const INCLUDE_DATA_TABLES = [
    "admin_api_keys",
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

// Tables that are intentionally schema-only. Listing them here (rather than
// relying on the default) documents *why* they're excluded and lets the
// classification check confirm every table has been considered. Keep
// alphabetised.
export const SCHEMA_ONLY_TABLES = [
    // The analytics_* tables ship schema-only here; their data travels in a
    // private sidecar dump instead. Keep them in sync with analyticsTables in
    // exportAnalyticsData.ts.
    "analytics_chart_views", // internal analytics, large
    "analytics_grapher_views", // internal analytics, large
    "analytics_pageviews", // internal analytics, large
    "donors", // donor PII
]

// The users table is exported with anonymised data (see anonymisedUsersSql
// in exportMetadata.ts).
export const USERS_TABLE = "users"

export function findUnclassifiedTables(allTables: string[]): string[] {
    const classified = new Set([
        ...INCLUDE_DATA_TABLES,
        ...SCHEMA_ONLY_TABLES,
        USERS_TABLE,
    ])
    return allTables.filter((t) => !classified.has(t))
}

export function unclassifiedTablesErrorMessage(unclassified: string[]): string {
    return (
        `the following tables are not classified in ` +
        `INCLUDE_DATA_TABLES or SCHEMA_ONLY_TABLES: ${unclassified.join(
            ", "
        )}.\nAdd each one to exactly one of those lists in ` +
        `db/exportMetadataTables.ts (data will only be exported for tables ` +
        `in INCLUDE_DATA_TABLES).`
    )
}
