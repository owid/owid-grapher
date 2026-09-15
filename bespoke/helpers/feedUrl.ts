/**
 * Where a bespoke component fetches its data feed from.
 *
 * ETL writes each feed to `<root>/<namespace>/<version>/<step>/` and the root depends on the
 * environment being served: `api.ourworldindata.org/v1/bespoke` in production, and
 * `api-staging.owid.io/<staging server>/v1/bespoke` on a staging server, where a branch's own
 * build of a feed lands (see `etl/viz/bespoke.py` in owid/etl). The page passes that root to
 * `mount()`; a bundle records it here once and builds its URLs from it.
 *
 * A module-level value rather than a React context: every component mounted on a page reads the
 * same feed root, and this way the three projects' data layers stay plain functions instead of
 * each threading a provider through its own component tree.
 */

/** Feed root of the production environment, used when the page passes none. */
export const PRODUCTION_FEED_ROOT = "https://api.ourworldindata.org/v1/bespoke"

let feedRoot = PRODUCTION_FEED_ROOT

/**
 * Point this bundle's data fetching at `root`. Call it from `mount()`, before rendering.
 * An empty or missing root leaves production's in place, so a bundle mounted by something that
 * doesn't know about feeds (the dev demo pages) still shows data.
 */
export function setFeedRoot(root: string | undefined): void {
    feedRoot = root?.trim() || PRODUCTION_FEED_ROOT
}

/**
 * URL of one file of a feed, e.g.
 * `feedUrl("ihme_gbd/latest/gbd_treemap_json", "causes-of-death.metadata.json")`.
 *
 * `step` is the ETL step's path without its `viz://bespoke/` prefix, which is what ETL names the
 * folder after. Call it when the URL is needed, not at module load: `mount()` sets the root, and
 * a module-level constant would be computed before that.
 */
export function feedUrl(step: string, file: string): string {
    return `${feedRoot.replace(/\/$/, "")}/${step}/${file}`
}
