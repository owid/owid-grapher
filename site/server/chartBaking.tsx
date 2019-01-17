import * as React from 'react'

import * as db from 'db/db'
import { JsonError } from 'util/server/serverUtil'
import { Chart } from 'db/model/Chart'
import { ChartConfigProps } from 'charts/ChartConfig'
import { ChartPage } from 'site/server/views/ChartPage'
import { renderToHtmlPage } from 'site/server/renderPage'
import { getVariableData } from 'db/model/Variable'

export async function chartDataJson(variableIds: number[]) {
    return await getVariableData(variableIds)
}

export async function chartPage(slug: string) {
    const chart = await Chart.getBySlug(slug)

    if (!chart)
        throw new JsonError("No such chart", 404)

    const c: ChartConfigProps = chart.config
    c.id = chart.id

    return renderToHtmlPage(<ChartPage chart={c}/>)
}