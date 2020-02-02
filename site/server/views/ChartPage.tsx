import { ChartConfigProps } from "charts/ChartConfig"
import { Post } from "db/model/Post"
import * as _ from "lodash"
import * as React from "react"
import { BAKED_GRAPHER_URL } from "settings"
import urljoin = require("url-join")
import { webpack } from "utils/server/staticGen"

import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export const ChartPage = (props: {
    chart: ChartConfigProps
    post?: Post.Row
}) => {
    const { chart, post } = props

    const pageTitle = chart.title
    const pageDesc =
        chart.subtitle || "An interactive visualization from Our World in Data."
    const canonicalUrl = urljoin(BAKED_GRAPHER_URL, chart.slug as string)
    const imageUrl = urljoin(
        BAKED_GRAPHER_URL,
        "exports",
        `${chart.slug}.png?v=${chart.version}`
    )

    const iframeScript = `
    if (window != window.top) {
        document.documentElement.classList.add('iframe')
    }
`

    const script = `
        var jsonConfig = ${JSON.stringify(chart)};
        var figure = document.getElementsByTagName("figure")[0];

        try {
            window.App = {};
            var view = window.ChartView.bootstrap({
                jsonConfig: jsonConfig,
                containerNode: figure,
                queryStr: window.location.search
            });
            view.bindToWindow();
        } catch (err) {
            figure.innerHTML = "<img src=\\"/grapher/exports/${
                chart.slug
            }.svg\\"/><p>Unable to load interactive visualization</p>";
            figure.setAttribute("id", "fallback");
            throw err;
        }
    `

    const variableIds = _.uniq(chart.dimensions.map(d => d.variableId))

    return (
        <html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
            >
                <meta property="og:image:width" content="850" />
                <meta property="og:image:height" content="600" />
                <script dangerouslySetInnerHTML={{ __html: iframeScript }} />
                <noscript>
                    <style>{`
                    figure { display: none !important; }
                `}</style>
                </noscript>
                <link rel="stylesheet" href={webpack("commons.css")} />
                <link
                    rel="preload"
                    href={`/grapher/data/variables/${variableIds.join(
                        "+"
                    )}.json?v=${chart.version}`}
                    as="fetch"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="ChartPage">
                <SiteHeader />
                <main>
                    <figure
                        data-grapher-src={`/grapher/${chart.slug}`}
                    ></figure>

                    {post && (
                        <div className="originReference">
                            This chart is part of a collection of research. For
                            more information, see{" "}
                            <a href={chart.originUrl}>{post.title}</a>.
                        </div>
                    )}
                    <noscript id="fallback">
                        <h1>{chart.title}</h1>
                        <p>{chart.subtitle}</p>
                        <img
                            src={`${BAKED_GRAPHER_URL}/exports/${chart.slug}.svg`}
                        />
                        <p>Interactive visualization requires JavaScript</p>
                    </noscript>
                </main>
                <script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch" />
                <script src={webpack("commons.js")} />
                <script src={webpack("owid.js")} />
                <script dangerouslySetInnerHTML={{ __html: script }} />
                <SiteFooter />
            </body>
        </html>
    )
}
