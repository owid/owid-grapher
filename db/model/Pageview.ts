import { keyBy } from "lodash"
import { Entity, Column, BaseEntity } from "typeorm"
import { RawPageview } from "@ourworldindata/utils"

@Entity("analytics_pageviews")
export class Pageview extends BaseEntity implements RawPageview {
    /** The last day with pageview data that is included in the sum */
    @Column({ primary: true }) day!: Date
    /**
     * The _absolute_ URL of the page, e.g. `https://ourworldindata.org/grapher/life-expectancy`.
     * Does not include any query parameters.
     * Usually does not include a trailing slash, except for the homepage (`/`) and 404s.
     */
    @Column({ primary: true }) url!: string
    /** Sum of pageviews over the last 7 days. */
    @Column() views_7d!: number
    /** Sum of pageviews over the last 14 days. */
    @Column() views_14d!: number
    /** Sum of pageviews over the last 365 days. */
    @Column() views_365d!: number

    static async getViewsByUrlObj(): Promise<{ [url: string]: RawPageview }> {
        const pageviews = await Pageview.find()

        // Normalize URLs to be relative to the root of the site.
        // This also filters out any URLs that don't start with ourworldindata.org.
        const pageviewsNormalized: RawPageview[] = pageviews.flatMap((p) => {
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
        })

        return keyBy(pageviewsNormalized, (p) => p.url)
    }
}
