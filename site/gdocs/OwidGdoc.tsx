import * as React from "react"
import {
    OwidGdocType,
    OwidGdoc as OwidGdocInterface,
    OwidGdocAboutInterface,
} from "@ourworldindata/types"
import { get } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { GdocPost } from "./pages/GdocPost.js"
import { DataInsightPage } from "./pages/DataInsight.js"
import { Fragment } from "./pages/Fragment.js"
import { Homepage } from "./pages/Homepage.js"
import { Author } from "./pages/Author.js"
import AboutPage from "./pages/AboutPage.js"
import { AttachmentsContext } from "./AttachmentsContext.js"
import { DocumentContext } from "./DocumentContext.js"

function AdminLinks() {
    return (
        <div id="gdoc-admin-bar">
            <a href="#" id="gdoc-link">
                Gdoc
            </a>
            <span>/</span>
            <a href="#" id="admin-link">
                Admin
            </a>
        </div>
    )
}

type OwidGdocProps = OwidGdocInterface & {
    isPreviewing?: boolean
}

export function OwidGdoc({
    isPreviewing = false,
    ...props
}: OwidGdocProps): React.ReactElement {
    const content = match(props)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                },
            },
            (props) => <GdocPost {...props} />
        )
        .with({ content: { type: OwidGdocType.AboutPage } }, (props) => (
            <AboutPage {...(props as OwidGdocAboutInterface)} />
        ))
        .with({ content: { type: OwidGdocType.DataInsight } }, (props) => (
            <DataInsightPage {...props} />
        ))
        .with({ content: { type: OwidGdocType.Homepage } }, (props) => (
            <Homepage {...props} />
        ))
        .with({ content: { type: OwidGdocType.Author } }, (props) => (
            <Author {...props} />
        ))
        .with({ content: { type: OwidGdocType.Fragment } }, (props) => (
            <Fragment {...props} />
        ))
        .with(P.any, (gdoc) => (
            <div
                className="grid grid-cols-12-full-width"
                style={{ height: 250 }}
            >
                <h3 className="span-cols-12 col-start-2">
                    Unknown article type: "{gdoc.content.type}"
                </h3>
                <p className="span-cols-12 col-start-2">
                    Must be one of: {Object.values(OwidGdocType).join(", ")}
                </p>
            </div>
        ))
        .run()

    return (
        <AttachmentsContext.Provider
            value={{
                donors: get(props, "donors", []),
                linkedAuthors: get(props, "linkedAuthors", []),
                linkedDocuments: get(props, "linkedDocuments", {}),
                imageMetadata: get(props, "imageMetadata", {}),
                linkedCharts: get(props, "linkedCharts", {}),
                linkedIndicators: get(props, "linkedIndicators", {}),
                relatedCharts: get(props, "relatedCharts", []),
                latestDataInsights: get(props, "latestDataInsights", []),
                homepageMetadata: get(props, "homepageMetadata", {}),
                latestWorkLinks: get(props, "latestWorkLinks", []),
                chartViewMetadata: get(props, "chartViewMetadata", {}),
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <AdminLinks />
                {content}
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
