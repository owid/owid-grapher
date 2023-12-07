import React, { createContext } from "react"
import ReactDOM from "react-dom"
import {
    LinkedChart,
    OwidGdocPostInterface,
    getOwidGdocFromJSON,
    ImageMetadata,
    RelatedChart,
    OwidGdocDataInsightInterface,
    get,
    OwidGdocType,
} from "@ourworldindata/utils"
import { DebugProvider } from "./DebugContext.js"
import { match, P } from "ts-pattern"
import { GdocPost } from "./pages/GdocPost.js"
import { DataInsight } from "./pages/DataInsight.js"
import { Fragment } from "./pages/Fragment.js"
export const AttachmentsContext = createContext<{
    linkedCharts: Record<string, LinkedChart>
    linkedDocuments: Record<string, OwidGdocPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    relatedCharts: RelatedChart[]
}>({
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    relatedCharts: [],
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

type OwidGdocProps = (OwidGdocPostInterface | OwidGdocDataInsightInterface) & {
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
            <DataInsight {...props} />
        ))
        .with({ content: { type: OwidGdocType.Fragment } }, (props) => (
            <Fragment {...props} />
        ))
        .with({ content: { type: undefined } }, () => (
            <div>Unknown article type</div>
        ))
        .exhaustive()

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: get(props, "linkedDocuments", {}),
                imageMetadata: get(props, "imageMetadata", {}),
                linkedCharts: get(props, "linkedCharts", {}),
                relatedCharts: get(props, "relatedCharts", []),
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
