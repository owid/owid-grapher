import * as React from 'react'

import * as db from 'src/db'
import { JsonError } from 'src/admin/serverUtil'
import { Chart } from 'src/model/Chart'
import { ChartConfigProps } from 'js/charts/ChartConfig'
import { ChartPage } from 'src/site/ChartPage'
import { renderToHtmlPage } from 'theme/src/renderPage'
import { getVariableData } from 'src/model/Variable';

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