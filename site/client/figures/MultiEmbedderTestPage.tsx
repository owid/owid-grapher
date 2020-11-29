import { EXPLORER_EMBEDDED_FIGURE_SELECTOR } from "explorer/ExplorerConstants"
import { GLOBAL_ENTITY_CONTROL_DATA_ATTR } from "grapher/controls/globalEntityControl/GlobalEntityControlConstants"
import { GRAPHER_EMBEDDED_FIGURE_ATTR } from "grapher/core/GrapherConstants"
import React from "react"
import { Head } from "site/server/Head"
import { SiteFooter } from "site/server/SiteFooter"
import { SiteHeader } from "site/server/SiteHeader"

export const MultiEmbedderTestPage = (
    globalEntityControl = false,
    slug = "embed-test-page",
    title = "MultiEmbedderTestPage"
) => {
    const style = {
        width: "600px",
        height: "400px",
        border: "1px solid blue",
    }
    return (
        <html>
            <Head canonicalUrl={slug} pageTitle={title} baseUrl="/" />
            <body>
                <SiteHeader baseUrl={""} />
                <main>
                    {globalEntityControl ? (
                        <div
                            {...{ [GLOBAL_ENTITY_CONTROL_DATA_ATTR]: true }}
                        ></div>
                    ) : null}
                    <p>
                        <a href="?globalEntityControl=true">
                            With Global Entity Control
                        </a>
                    </p>
                    <h1>A grapher about sharks</h1>
                    <figure
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
                        style={style}
                        {...{
                            [GRAPHER_EMBEDDED_FIGURE_ATTR]:
                                "http://localhost:3030/grapher/total-shark-attacks-per-year?time=latest",
                        }}
                    />
                    <h1>An explorer about co2</h1>
                    <figure
                        style={style}
                        {...{
                            [EXPLORER_EMBEDDED_FIGURE_SELECTOR]:
                                "http://localhost:3030/explorers/co2",
                        }}
                    />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <h1>
                        An explorer far down the page, hopefully loaded lazily
                    </h1>
                    <figure
                        style={style}
                        {...{
                            [EXPLORER_EMBEDDED_FIGURE_SELECTOR]:
                                "http://localhost:3030/explorers/co2",
                        }}
                    />
                </main>
                <SiteFooter baseUrl={""} />
            </body>
        </html>
    )
}
