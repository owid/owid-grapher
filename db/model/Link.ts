import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { Url } from "@ourworldindata/utils"
import { formatUrls } from "../../site/formatting.js"
import {
    ContentGraphLinkType,
    DbInsertContentGraphLink,
    DbPlainPostGdocLink,
} from "@ourworldindata/types"
import { KnexReadonlyTransaction, knexRaw } from "../db.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

export async function getPublishedLinksTo(
    knex: KnexReadonlyTransaction,
    ids: string[],
    linkType?: ContentGraphLinkType
): Promise<
    (DbPlainPostGdocLink & {
        title: string
        slug: string
        id: string
        url: string
    })[]
> {
    const linkTypeClause = linkType ? "AND linkType = ?" : ""
    const params = linkType ? [ids, linkType] : [ids]
    const rows = await knexRaw<
        DbPlainPostGdocLink & {
            title: string
            slug: string
            id: string
            url: string
        }
    >(
        knex,
        `-- sql
        SELECT
            pgl.*,
            pg.content ->> '$.title' AS title,
            pg.slug AS slug,
            pg.id AS id,
            CONCAT("${BAKED_BASE_URL}","/",pg.slug) as url
        FROM
            posts_gdocs_links pgl
            JOIN posts_gdocs pg ON pgl.sourceId = pg.id
        WHERE
            target IN (?)
            ${linkTypeClause}
            AND published = TRUE
    `,
        params
    )
    return rows
}

export function createLinkFromUrl({
    url,
    sourceId,
    text = "",
    componentType = "",
}: {
    url: string
    sourceId: string | number
    text?: string
    componentType?: string
}): DbInsertContentGraphLink {
    const formattedUrl = formatUrls(url)
    const urlObject = Url.fromURL(formattedUrl)
    const linkType = getLinkType(formattedUrl)
    const target = getUrlTarget(formattedUrl)
    const queryString = urlObject.queryStr
    const hash = urlObject.hash
    return {
        target,
        linkType,
        queryString,
        hash,
        text,
        componentType,
        sourceId,
    } satisfies DbInsertContentGraphLink
}

export function createLinkForChartView({
    name,
    sourceId,
    componentType,
}: {
    name: string
    sourceId: string
    componentType: string
}): DbInsertContentGraphLink {
    return {
        target: name,
        linkType: ContentGraphLinkType.ChartView,
        queryString: "",
        hash: "",
        text: "",
        componentType,
        sourceId,
    } satisfies DbInsertContentGraphLink
}
