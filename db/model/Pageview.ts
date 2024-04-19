import { keyBy } from "lodash"
import * as db from "../db.js"
import {
    DbPlainAnalyticsPageview,
    AnalyticsPageviewsTableName,
} from "@ourworldindata/types"

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

    return keyBy(pageviewsNormalized, (p) => p.url)
}
