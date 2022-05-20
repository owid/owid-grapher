import { MigrationInterface, QueryRunner } from "typeorm"
import * as wpdb from "../wpdb.js"
import { TopicId } from "../../clientUtils/owidTypes.js"
import { Topic } from "../../grapher/core/GrapherConstants.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { getTopics } from "../wpdb.js"
import { Url } from "../../clientUtils/urls/Url.js"

/**
 * This migration goes through all charts and based on their originUrl,
 * attributes them a Topic. Since originUrls might be redirected, they are first
 * resolved through the internal resolver before attempting a match with a
 * Wordpress Topic.
 *
 * NB: the resolver code has been duplicated here. The structure of TS project
 * doesn't allow for db -> baker imports, and refactoring for a migration made
 * little sense.
 */
export class TopicsOriginUrl1652989496261 implements MigrationInterface {
    // Adapted from redirect.ts
    static async getWordpressRedirectsMap(): Promise<Map<string, string>> {
        // source: pathnames only (e.g. /transport)
        // target: pathnames with or without origins (e.g. /transport-new or https://ourworldindata.org/transport-new)
        const redirects = new Map()

        // todo(refactor) : export as function to reuse in getRedirects?
        const wordpressRedirectRows = await wpdb.singleton.query(
            `SELECT url, action_data FROM wp_redirection_items WHERE status = 'enabled'`
        )

        for (const row of wordpressRedirectRows) {
            redirects.set(row.url, row.action_data)
        }

        return redirects
    }

    static isCanonicalInternalUrl(url: Url): boolean {
        if (!url.originAndPath) return false
        // no origin === links without e.g. https://ourworldindata.org
        return !url.origin || url.origin.startsWith(BAKED_BASE_URL)
    }

    // Adapted from redirect.ts
    static async resolveWordpressRedirect(url: Url): Promise<Url> {
        const MAX_RECURSION_DEPTH = 25
        let recursionDepth = 0
        const originalUrl = url

        const _resolveWordpressRedirect = async (url: Url): Promise<Url> => {
            ++recursionDepth
            if (recursionDepth > MAX_RECURSION_DEPTH) {
                console.log(
                    `A circular redirect (/a -> /b -> /a) has been detected for ${originalUrl.pathname} and is ignored.`
                )
                return originalUrl
            }

            if (
                !url.pathname ||
                !TopicsOriginUrl1652989496261.isCanonicalInternalUrl(url)
            )
                return url

            const redirects =
                await TopicsOriginUrl1652989496261.getWordpressRedirectsMap()
            const target = redirects.get(url.pathname)

            if (!target) return url
            const targetUrl = Url.fromURL(target)

            if (targetUrl.pathname === url.pathname) {
                console.log(
                    `A self redirect (/a -> /a) has been detected for ${originalUrl.pathname} and is ignored.`
                )
                return originalUrl
            }

            return _resolveWordpressRedirect(
                // Pass query params through only if none present on the target (cf.
                // netlify behaviour)
                url.queryStr && !targetUrl.queryStr
                    ? targetUrl.setQueryParams(url.queryParams)
                    : targetUrl
            )
        }
        return _resolveWordpressRedirect(url)
    }

    // Adapted from redirect.ts
    static async resolveInternalRedirect(url: Url): Promise<Url> {
        if (!TopicsOriginUrl1652989496261.isCanonicalInternalUrl(url)) {
            return url
        }
        return TopicsOriginUrl1652989496261.resolveWordpressRedirect(url)
    }

    static async resolveOriginUrl(originUrl: string): Promise<Url> {
        return TopicsOriginUrl1652989496261.resolveInternalRedirect(
            Url.fromURL(
                originUrl
                    .replace(
                        new RegExp("(https?://)?ourworldindata.org", "i"),
                        BAKED_BASE_URL
                    )
                    .replace(new RegExp("/$"), "")
            )
        )
    }

    static getTopicId(
        topicPath: string | undefined,
        allTopics: Topic[]
    ): TopicId | undefined {
        return allTopics.find((t) => Url.fromURL(t.url).pathname === topicPath)
            ?.id
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        const allTopics = await getTopics()
        const topicsNotFound = new Set()

        const rows = await queryRunner.query(
            `
            SELECT charts.id, charts.config->>"$.originUrl" AS originUrl
            FROM charts
            HAVING originUrl <> ""
        `
        )
        for (const row of rows) {
            const originUrl =
                await TopicsOriginUrl1652989496261.resolveOriginUrl(
                    row.originUrl
                )

            // in the WP redirects table, targets might be fully qualified URLs
            // or just pathnames. resolveOriginUrl() doesn't normalize this and
            // passes the discrepancy along. To simplify things, we're matching
            // topics on pathnames only. We could add an extra check here to
            // verify that we are only getting topic IDs for OWID URLs (e.g.
            // https://ourworldindata.org/poverty vs
            // https://some-domain.org/poverty) but I consider this a positive
            // side-effect: no matter the domain name /poverty is likely to mean
            // the same topic allocation on OWID, i.e. Poverty.

            const topicId = TopicsOriginUrl1652989496261.getTopicId(
                originUrl.pathname,
                allTopics
            )

            if (!topicId) {
                topicsNotFound.add(originUrl.fullUrl)
                continue
            }

            await queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(charts.config, "$.topicIds", JSON_ARRAY(${topicId}))
            WHERE id=${row.id};
            `)
        }
        console.log(topicsNotFound)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        UPDATE charts
        SET config = JSON_REMOVE(charts.config, "$.topicIds")
        `)
    }
}
