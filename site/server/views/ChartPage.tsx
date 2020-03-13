import { BAKED_GRAPHER_URL } from "settings"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"

import * as React from "react"
import urljoin = require("url-join")
import * as _ from "lodash"

import { webpack } from "utils/server/staticGen"
import { ChartConfigProps } from "charts/ChartConfig"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { Head } from "./Head"
import { Post } from "db/model/Post"

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
                            <a href={chart.originUrl}>
                                Here is all our research and data on{" "}
                                <strong>{post.title}</strong>.
                                <FontAwesomeIcon icon={faArrowRight} />
                            </a>
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
                <SiteFooter />
                <script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch" />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
