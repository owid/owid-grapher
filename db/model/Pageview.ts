import * as _ from "lodash-es"
import * as db from "../db.js"
import {
    DbPlainAnalyticsPageview,
    AnalyticsPageviewsTableName,
} from "@ourworldindata/types"

export async function assertAnalyticsPageviewsPopulated(
    knex: db.KnexReadonlyTransaction
): Promise<void> {
    const result = await db.knexRaw<{ count: number }>(
        knex,
        "SELECT COUNT(*) as count FROM ?? LIMIT 1",
        [AnalyticsPageviewsTableName]
    )
    if (result[0].count === 0) {
        throw new Error(
            `The ${AnalyticsPageviewsTableName} table is empty. Please populate it running make refresh.analytics`
        )
    }
}

export async function getAnalyticsPageviewsByUrlObj(
    knex: db.KnexReadonlyTransaction
): Promise<{
    [url: string]: DbPlainAnalyticsPageview
}> {
    const pageviews = await db.knexRaw<DbPlainAnalyticsPageview>(
        knex,
        "SELECT * FROM ??",
        [AnalyticsPageviewsTableName]
    )

    // Normalize URLs to be relative to the root of the site.
    // This also filters out any URLs that don't start with ourworldindata.org.
    const pageviewsNormalized = pageviews.flatMap(
        (p: DbPlainAnalyticsPageview) => {
            if (p.url.startsWith("https://ourworldindata.org/"))
                return [
                    {
                        ...p,
                        url: p.url.replace(
                            new RegExp("^https://ourworldindata.org"),
                            ""
                        ),
                    },
                ]
            else return []
        }
    )

    return _.keyBy(pageviewsNormalized, (p) => p.url)
}
