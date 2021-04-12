import { Url } from "./Url"

export type UrlMigration = (url: Url) => Url

export const performUrlMigrations = (
    migrations: readonly UrlMigration[],
    url: Url
): Url => {
    return migrations.reduce((url, migration) => migration(url), url)
}
