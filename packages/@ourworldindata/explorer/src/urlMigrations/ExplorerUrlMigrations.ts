import { Url, UrlMigration, performUrlMigrations } from "@ourworldindata/utils"

import { legacyCovidMigrationSpec } from "./LegacyCovidUrlMigration.js"
import { co2UrlMigration } from "./CO2UrlMigration.js"
import { energyUrlMigration } from "./EnergyUrlMigration.js"
import { covidUrlMigration } from "./CovidUrlMigration.js"

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

const explorerUrlMigrations: UrlMigration[] = [
    // NOTE: The order of migrations matters!
    co2UrlMigration,
    energyUrlMigration,
    covidUrlMigration,
]

export const migrateExplorerUrl: UrlMigration = (url: Url): Url => {
    return performUrlMigrations(explorerUrlMigrations, url)
}
