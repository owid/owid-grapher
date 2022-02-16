import { ExplorerUrlMigrationId } from "./ExplorerUrlMigrations.js"

/**
 * An object spec that gets encoded into pages that redirect to an explorer.
 *
 * It's encoded as a JSON object on the page in order to avoid storing all redirects
 * in the client-side bundle.
 */
export interface ExplorerPageUrlMigrationSpec {
    explorerUrlMigrationId: ExplorerUrlMigrationId
    baseQueryStr: string
}
