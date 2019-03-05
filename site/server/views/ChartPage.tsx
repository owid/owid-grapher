import {BAKED_GRAPHER_URL} from 'settings'

import * as React from 'react'
import * as urljoin from 'url-join'
import * as _ from 'lodash'

import { webpack } from 'utils/server/staticGen'
import { ChartConfigProps } from 'charts/ChartConfig'
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { Head } from './Head';

export const ChartPage = (props: { chart: ChartConfigProps }) => {
    const {chart} = props

    const pageTitle = chart.title
    const pageDesc = chart.subtitle || "An interactive visualization from Our World in Data."
    const canonicalUrl = urljoin(BAKED_GRAPHER_URL, chart.slug as string)
    const imageUrl = urljoin(BAKED_GRAPHER_URL, "exports", `${chart.slug}.png?v=${chart.version}`)

    const iframeScript = `
    if (window != window.top) {
        document.documentElement.classList.add('iframe')
    }
`

    const style = `
        .ChartPage main figure[data-grapher-src], #fallback {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            margin: 0;
            width: 100%;
            height: 100%;
        }

        #fallback > img {
            max-width: 100%;
            border: 1px solid #ccc;
        }
    `

    const script = `
        var jsonConfig = ${JSON.stringify(chart)};
        var figure = document.getElementsByTagName("figure")[0];

        try {
            window.App = {};
            window.ChartView.bootstrap({ jsonConfig: jsonConfig, containerNode: figure });
        } catch (err) {
            figure.innerHTML = "<img src=\\"/grapher/exports/${chart.slug}.svg\\"/><p>Unable to load interactive visualization</p>";
            figure.setAttribute("id", "fallback");
            throw err;
        }
    `

    const variableIds = _.uniq(chart.dimensions.map(d => d.variableId))

    return <html>
        <Head canonicalUrl={canonicalUrl} pageTitle={pageTitle} pageDesc={pageDesc} imageUrl={imageUrl}>
            <meta property="og:image:width" content="850"/>
            <meta property="og:image:height" content="600"/>
            <style dangerouslySetInnerHTML={{__html: style}}/>
            <script dangerouslySetInnerHTML={{__html: iframeScript}}/>
            <noscript>
                <style>{`
                    figure { display: none !important; }
                `}</style>
            </noscript>
            <link rel="stylesheet" href={webpack("commons.css")}/>
            <link rel="preload" href={`/grapher/data/variables/${variableIds.join("+")}.json?v=${chart.version}`} as="fetch" crossOrigin="anonymous"/>
        </Head>
        <body className="ChartPage">
            <SiteHeader/>
            <main>
                <figure data-grapher-src={`/grapher/${chart.slug}`}>
                </figure>
                <noscript id="fallback">
                    <h1>{chart.title}</h1>
                    <p>{chart.subtitle}</p>
                    <img src={`${BAKED_GRAPHER_URL}/exports/${chart.slug}.svg`}/>
                    <p>Interactive visualization requires JavaScript</p>
                </noscript>
            </main>
            <script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch"/>
            <script src={webpack("commons.js")}/>
            <script src={webpack("owid.js")}/>
            <script dangerouslySetInnerHTML={{__html: script}}/>
            <SiteFooter/>
        </body>
    </html>
}
