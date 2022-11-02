import { Url } from "./Url.js"

export type UrlMigration = (url: Url) => Url

export const performUrlMigrations = (
    migrations: UrlMigration[],
    url: Url
): Url => {
    return migrations.reduce((url, migration) => migration(url), url)
}
