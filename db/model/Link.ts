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
    const rows = await knexRaw<DbPlainPostGdocLink & { sourceSlug: string }>(
        knex,
        `-- sql
        select posts_gdocs_links.*, posts_gdocs.slug as sourceSlug
        from posts_gdocs_links
        join posts_gdocs on posts_gdocs_links.source = posts_gdocs.id
        where target in (?) and linkType = ?
        and published = true
    `,
        [ids, linkType]
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
