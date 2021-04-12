import { Url } from "../../clientUtils/urls/Url"
import {
    performUrlMigrations,
    UrlMigration,
} from "../../clientUtils/urls/UrlMigration"
import { legacyCovidMigrationSpec } from "./LegacyCovidUrlMigration"
import { co2UrlMigration } from "./CO2UrlMigration"
import { energyUrlMigration } from "./EnergyUrlMigration"
import { covidUrlMigration } from "./CovidUrlMigration"

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

const explorerUrlMigrations: readonly UrlMigration[] = [
    // NOTE: The order of migrations matters!
    co2UrlMigration,
    energyUrlMigration,
    covidUrlMigration,
]

export const migrateExplorerUrl: UrlMigration = (url: Url): Url => {
    return performUrlMigrations(explorerUrlMigrations, url)
}
