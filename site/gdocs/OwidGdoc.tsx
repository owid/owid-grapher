import React, { createContext } from "react"
import ReactDOM from "react-dom"
import {
    LinkedChart,
    getOwidGdocFromJSON,
    ImageMetadata,
    RelatedChart,
    get,
    OwidGdocType,
    OwidGdoc as OwidGdocInterface,
    MinimalDataInsightInterface,
    OwidGdocMinimalPostInterface,
} from "@ourworldindata/utils"
import { DebugProvider } from "./DebugContext.js"
import { match, P } from "ts-pattern"
import { GdocPost } from "./pages/GdocPost.js"
import { DataInsightPage } from "./pages/DataInsight.js"
import { Fragment } from "./pages/Fragment.js"

export const AttachmentsContext = createContext<{
    linkedCharts: Record<string, LinkedChart>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    relatedCharts: RelatedChart[]
    latestDataInsights?: MinimalDataInsightInterface[]
}>({
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    relatedCharts: [],
    latestDataInsights: [],
})

export const DocumentContext = createContext<{ isPreviewing: boolean }>({
    isPreviewing: false,
})

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
}: OwidGdocProps): JSX.Element {
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
        .with({ content: { type: OwidGdocType.DataInsight } }, (props) => (
            <DataInsightPage {...props} />
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
                linkedDocuments: get(props, "linkedDocuments", {}),
                imageMetadata: get(props, "imageMetadata", {}),
                linkedCharts: get(props, "linkedCharts", {}),
                relatedCharts: get(props, "relatedCharts", []),
                latestDataInsights: get(props, "latestDataInsights", []),
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <AdminLinks />
                {content}
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}

export const hydrateOwidGdoc = (debug?: boolean, isPreviewing?: boolean) => {
    const wrapper = document.querySelector("#owid-document-root")
    const props = getOwidGdocFromJSON(window._OWID_GDOC_PROPS)
    ReactDOM.hydrate(
        <React.StrictMode>
            <DebugProvider debug={debug}>
                <OwidGdoc {...props} isPreviewing={isPreviewing} />
            </DebugProvider>
        </React.StrictMode>,
        wrapper
    )
}
