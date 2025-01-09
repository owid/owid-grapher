import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { Url } from "@ourworldindata/utils"
import { GdocBase } from "./Gdoc/GdocBase.js"
import { formatUrls } from "../../site/formatting.js"
import {
    DbInsertPostGdocLink,
    DbPlainPostGdocLink,
    OwidGdocLinkType,
} from "@ourworldindata/types"
import { KnexReadonlyTransaction, knexRaw } from "../db.js"

export async function getPublishedLinksTo(
    knex: KnexReadonlyTransaction,
    ids: string[],
    linkType?: OwidGdocLinkType
): Promise<(DbPlainPostGdocLink & { sourceSlug: string })[]> {
    const linkTypeClause = linkType ? "AND linkType = ?" : ""
    const params = linkType ? [ids, linkType] : [ids]
    const rows = await knexRaw<DbPlainPostGdocLink & { sourceSlug: string }>(
        knex,
        `-- sql
        SELECT
            posts_gdocs_links.*,
            posts_gdocs.slug AS sourceSlug
        FROM
            posts_gdocs_links
            JOIN posts_gdocs ON posts_gdocs_links.sourceId = posts_gdocs.id
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
    source,
    text = "",
    componentType = "",
}: {
    url: string
    source: GdocBase
    text?: string
    componentType?: string
}): DbInsertPostGdocLink {
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
        sourceId: source.id,
    } satisfies DbInsertPostGdocLink
}

export function createLinkForChartView({
    name,
    source,
    componentType,
}: {
    name: string
    source: GdocBase
    componentType: string
}): DbInsertPostGdocLink {
    return {
        target: name,
        linkType: OwidGdocLinkType.ChartView,
        queryString: "",
        hash: "",
        text: "",
        componentType,
        sourceId: source.id,
    } satisfies DbInsertPostGdocLink
}
