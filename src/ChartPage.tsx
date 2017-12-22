import * as React from 'react'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import * as path from 'path'

export const ChartPage = (props: { canonicalRoot: string, pathRoot: string, chart: ChartConfigProps }) => {
    const {chart, canonicalRoot, pathRoot} = props

    const pageTitle = chart.title
    const pageDesc = chart.subtitle || "An interactive visualization from Our World in Data."
    const canonicalUrl = path.join(canonicalRoot, pathRoot, chart.slug as string)
    const imageUrl = `${canonicalUrl}.png`

    return <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>{pageTitle} - Our World in Data</title>
            <meta name="description" content={pageDesc}/>
            <link rel="canonical" href={canonicalUrl}/>
            <meta property="fb:app_id" content="1149943818390250"/>
            <meta property="og:url" content={canonicalUrl}/>
            <meta property="og:title" content={pageTitle}/>
            <meta property="og:description" content={pageDesc}/>
            <meta property="og:image" content={imageUrl}/>
            <meta property="og:image:width" content="1200"/>
            <meta property="og:image:height" content="630"/>
            <meta property="og:site_name" content="Our World in Data"/>
            <meta name="twitter:card" content="summary_large_image"/>
            <meta name="twitter:site" content="@OurWorldInData"/>
            <meta name="twitter:creator" content="@OurWorldInData"/>
            <meta name="twitter:title" content={pageTitle}/>
            <meta name="twitter:description" content={pageDesc}/>
            <meta name="twitter:image" content={imageUrl}/>
            <style>
                {`html, body {
                    height: 100%;
                    margin: 0;
                }

                figure[data-grapher-src] {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    width: 100%;
                    height: 100%;
                }`}
            </style>
            <script src={`${pathRoot}/embedCharts.js`}/>
        </head>
        <body className="singleChart">
            <figure data-grapher-src={`${pathRoot}/${chart.slug}`}/>
        </body>
    </html>
}
