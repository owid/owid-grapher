import * as _ from "lodash-es"
import * as React from "react"
import { OwidGdocType } from "@ourworldindata/types"
import { OwidGdocPageProps } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { GdocPost } from "./pages/GdocPost.js"
import { DataInsightPage } from "./pages/DataInsight.js"
import { Fragment } from "./pages/Fragment.js"
import { Homepage } from "./pages/Homepage.js"
import { Author } from "./pages/Author.js"
import AboutPage from "./pages/AboutPage.js"
import { AttachmentsContext } from "./AttachmentsContext.js"
import { DocumentContext } from "./DocumentContext.js"
import { AnnouncementPage } from "./pages/Announcement.js"

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

type OwidGdocProps = OwidGdocPageProps & {
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
            <AboutPage {...props} />
        ))
        .with({ content: { type: OwidGdocType.DataInsight } }, (props) => (
            <DataInsightPage {...props} />
        ))
        .with({ content: { type: OwidGdocType.Announcement } }, (props) => (
            <AnnouncementPage {...props} />
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
                    Unknown article type: "{gdoc.content?.type}"
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
                donors: _.get(props, "donors", []),
                linkedAuthors: _.get(props, "linkedAuthors", []),
                linkedDocuments: _.get(props, "linkedDocuments", {}),
                imageMetadata: _.get(props, "imageMetadata", {}),
                linkedCharts: _.get(props, "linkedCharts", {}),
                linkedIndicators: _.get(props, "linkedIndicators", {}),
                relatedCharts: _.get(props, "relatedCharts", []),
                latestDataInsights: _.get(props, "latestDataInsights", []),
                homepageMetadata: _.get(props, "homepageMetadata", {}),
                latestWorkLinks: _.get(props, "latestWorkLinks", []),
                linkedNarrativeCharts: _.get(
                    props,
                    "linkedNarrativeCharts",
                    {}
                ),
                // lodash doesn't use fallback when value is null
                tags: props.tags ?? [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <AdminLinks />
                {content}
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
