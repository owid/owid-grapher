import {
    GLOBAL_ENTITY_SELECTOR_DATA_ATTR,
    GRAPHER_EMBEDDED_FIGURE_ATTR,
} from "@ourworldindata/grapher"
import { EXPLORER_EMBEDDED_FIGURE_SELECTOR } from "@ourworldindata/explorer"
import { Head } from "../../site/Head.js"
import { SiteFooter } from "../../site/SiteFooter.js"
import { SiteHeader } from "../../site/SiteHeader.js"
import { Html } from "../Html.js"

export const MultiEmbedderTestPage = (
    globalEntitySelector = false,
    slug = "embed-test-page",
    title = "MultiEmbedderTestPage"
) => {
    const style = {
        width: "600px",
        height: "400px",
        border: "1px solid blue",
    }
    const styleExplorer = {
        ...style,
        width: "1200px",
        height: "600px",
    }
    return (
        <Html>
            <Head canonicalUrl={slug} pageTitle={title} baseUrl="/" />
            <body>
                <SiteHeader />
                <main style={{ padding: "1rem" }}>
                    {globalEntitySelector ? (
                        <div
                            {...{ [GLOBAL_ENTITY_SELECTOR_DATA_ATTR]: true }}
                        ></div>
                    ) : null}
                    <p>
                        <a href="?globalEntitySelector=true">
                            With Global Entity Control
                        </a>
                    </p>
                    <h1>A grapher about sharks</h1>
                    <figure
                        data-test="within-bounds"
                        style={style}
                        {...{
                            [GRAPHER_EMBEDDED_FIGURE_ATTR]:
                                "http://localhost:3030/grapher/total-shark-attacks-per-year",
                        }}
                    />
                    <h1>
                        A grapher about sharks with different params
                        (time=latest)
                    </h1>
                    <figure
                        data-test="within-bounds"
                        style={style}
                        {...{
                            [GRAPHER_EMBEDDED_FIGURE_ATTR]:
                                "http://localhost:3030/grapher/total-shark-attacks-per-year?time=latest",
                        }}
                    />
                    <h1>
                        The same grapher loaded through an iframe (embed on
                        external sites)
                    </h1>
                    Note: the MultiEmbedder is not being called in this context.
                    The rendering paths of external embeds and charts on content
                    pages do converge at some point, but later. So any change on
                    the MultiEmbedder has no effect on the charts embedded on
                    external sites (and the grapher pages they rely on).
                    <pre>
                        {`
        Chart on   ─────► MultiEmbedder  ───────────────────────────►  renderGrapherIntoContainer()
        OWID page                                                                   ▲
                                                                                    │
                                                                                    │
     Grapher page  ─────► renderSingleGrapherOnGrapherPage() ───────────────────────┘

          ▲
          │
          │
          │

Chart embedded on
    external site
                        `}
                    </pre>
                    <iframe
                        src="http://localhost:3030/grapher/total-shark-attacks-per-year?time=latest"
                        loading="lazy"
                        style={{ ...style, marginLeft: "40px" }}
                    ></iframe>
                    <h1>An explorer about co2</h1>
                    <figure
                        data-test="within-bounds"
                        style={styleExplorer}
                        {...{
                            [EXPLORER_EMBEDDED_FIGURE_SELECTOR]:
                                "http://localhost:3030/explorers/co2",
                        }}
                    />
                    <h1 data-test="heading-before-spacer">
                        When you see this, the explorer located 2 viewports
                        below will start loading.
                    </h1>
                    200vh matches MultiEmbedder's IntersectionObserver
                    rootMargin parameter of 200%. You can manually test this by
                    adding a console.log() to renderInteractiveFigure(), or look
                    into the DOM and check whether the figure element below is
                    populated (it shouldn't be until you reveal this text).
                    <div style={{ height: "200vh" }}></div>
                    <figure
                        data-test="out-of-bounds"
                        style={styleExplorer}
                        {...{
                            [EXPLORER_EMBEDDED_FIGURE_SELECTOR]:
                                "http://localhost:3030/explorers/co2",
                        }}
                    />
                </main>
                <SiteFooter />
            </body>
        </Html>
    )
}
