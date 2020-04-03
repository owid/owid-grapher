import * as React from "react"

import { JsonError } from "utils/server/serverUtil"
import { Chart } from "db/model/Chart"
import { ChartConfigProps } from "charts/ChartConfig"
import { ChartPage } from "site/server/views/ChartPage"
import { renderToHtmlPage } from "site/server/siteBaking"
import { getVariableData } from "db/model/Variable"
import { Post } from "db/model/Post"
import { urlToSlug } from "charts/Util"

export async function chartDataJson(variableIds: number[]) {
    return await getVariableData(variableIds)
}

export async function chartPageFromConfig(chart: ChartConfigProps) {
    const postSlug = urlToSlug(chart.originUrl || "")
    const post = postSlug ? await Post.bySlug(postSlug) : undefined
    return renderToHtmlPage(<ChartPage chart={chart} post={post} />)
}

export async function chartPageFromSlug(slug: string) {
    const entity = await Chart.getBySlug(slug)
    if (!entity) throw new JsonError("No such chart", 404)
    return chartPageFromConfig(entity.config)
}
