import * as React from "react"

import { JsonError } from "utils/server/serverUtil"
import { Chart } from "db/model/Chart"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { GrapherPage } from "site/server/views/GrapherPage"
import { renderToHtmlPage } from "site/server/siteRenderers"
import { getVariableData } from "db/model/Variable"
import { Post } from "db/model/Post"
import { urlToSlug } from "grapher/utils/Util"
import { getRelatedCharts } from "db/wpdb"
import { getReferencesByChartId } from "adminSite/server/apiRouter"

export async function chartDataJson(variableIds: number[]) {
    return await getVariableData(variableIds)
}

export async function grapherPageFromConfig(grapher: GrapherInterface) {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await Post.bySlug(postSlug) : undefined
    const relatedCharts = post ? await getRelatedCharts(post.id) : undefined
    const relatedArticles = grapher.id
        ? await getReferencesByChartId(grapher.id)
        : undefined
    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
        />
    )
}

export async function grapherPageFromSlug(slug: string) {
    const entity = await Chart.getBySlug(slug)
    if (!entity) throw new JsonError("No such chart", 404)
    return grapherPageFromConfig(entity.config)
}
