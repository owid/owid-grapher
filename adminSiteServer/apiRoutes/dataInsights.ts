import e from "express"
import { Request } from "../authentication.js"
import {
    DbRawPostGdoc,
    OwidGdocDataInsightIndexItem,
    OwidGdocDataInsightInterface,
    parsePostsGdocsRow,
    PostsGdocsTableName,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { getTagsGroupedByGdocId } from "../../db/model/Gdoc/GdocFactory.js"

export async function getAllDataInsightIndexItems(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return getAllDataInsightIndexItemsOrderedByUpdatedAt(trx)
}

async function getAllDataInsightIndexItemsOrderedByUpdatedAt(
    knex: db.KnexReadonlyTransaction
): Promise<OwidGdocDataInsightIndexItem[]> {
    const dataInsights: DbRawPostGdoc[] = await knex
        .table<DbRawPostGdoc>(PostsGdocsTableName)
        .where("type", "data-insight")
        .orderBy("updatedAt", "desc")
    const groupedTags = await getTagsGroupedByGdocId(
        knex,
        dataInsights.map((gdoc) => gdoc.id)
    )
    return dataInsights.map((gdoc) =>
        extractDataInsightIndexItem({
            ...(parsePostsGdocsRow(gdoc) as OwidGdocDataInsightInterface),
            tags: groupedTags[gdoc.id] ? groupedTags[gdoc.id] : null,
        })
    )
}

function extractDataInsightIndexItem(
    gdoc: OwidGdocDataInsightInterface
): OwidGdocDataInsightIndexItem {
    const grapherUrl = gdoc.content["grapher-url"]?.trim()
    const isGrapherUrl = grapherUrl?.startsWith(
        "https://ourworldindata.org/grapher/"
    )
    const isExplorerUrl = grapherUrl?.startsWith(
        "https://ourworldindata.org/explorers/"
    )

    return {
        id: gdoc.id,
        slug: gdoc.slug,
        tags: gdoc.tags ?? [],
        published: gdoc.published,
        publishedAt: gdoc.publishedAt,
        title: gdoc.content.title ?? "",
        authors: gdoc.content.authors,
        markdown: gdoc.markdown,
        "approved-by": gdoc.content["approved-by"],
        "narrative-view": gdoc.content["narrative-view"],
        "grapher-url": isGrapherUrl ? grapherUrl : undefined,
        "explorer-url": isExplorerUrl ? grapherUrl : undefined,
        "figma-url": gdoc.content["figma-url"],
    }
}
