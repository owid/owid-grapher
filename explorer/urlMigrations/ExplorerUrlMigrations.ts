import { Url } from "../../urls/Url"
import { EXPLORERS_ROUTE_FOLDER } from "../ExplorerConstants"
import { UrlMigration } from "../../urls/UrlMigration"
import { legacyCovidMigrationSpec } from "./LegacyCovidUrlMigration"
import { co2UrlMigration } from "./CO2UrlMigration"

export enum ExplorerUrlMigrationId {
    legacyToGridCovidExplorer = "legacyToGridCovidExplorer",
}

export interface ExplorerUrlMigrationSpec {
    explorerSlug: string
    migrateUrl: (url: Url, baseQueryStr: string) => Url
}

export const explorerUrlMigrationsById: Record<
    ExplorerUrlMigrationId,
    ExplorerUrlMigrationSpec
> = {
    legacyToGridCovidExplorer: legacyCovidMigrationSpec,
}

const explorerUrlMigrationsByExplorerSlug: Record<string, UrlMigration> = {
    co2: co2UrlMigration,
}

const getExplorerSlugFromPath = (path: string): string | undefined => {
    const match = path.match(
        new RegExp(`^\/+${EXPLORERS_ROUTE_FOLDER}\/+([^\/]+)`)
    )
    if (match && match[1]) return match[1]
    return undefined
}

export const migrateExplorerUrl: UrlMigration = (url: Url): Url => {
    if (!url.pathname) return url

    const explorerSlug = getExplorerSlugFromPath(url.pathname)
    if (!explorerSlug) return url

    const migrateUrl = explorerUrlMigrationsByExplorerSlug[explorerSlug]
    if (!migrateUrl) return url

    return migrateUrl(url)
}
