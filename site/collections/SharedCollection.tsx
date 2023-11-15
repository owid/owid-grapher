import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { COLLECTIONS_PAGE_CONTAINER_ID } from "@ourworldindata/utils"

export const SharedCollection = (props: { baseUrl: string }) => {
    const { baseUrl } = props
    const [collections, setCollections] = useState("")

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const linkedCollection = urlParams.get("charts")
        if (linkedCollection) {
            setCollections(linkedCollection)
            return
        }
        // TODO: Do this in a separate component so we can have separate routes
        // const savedCollection = localStorage.getItem(
        //     COLLECTIONS_LOCAL_STORAGE_KEY
        // )
        // if (savedCollection) {
        //     setCollections(savedCollection)
        //     return
        // }
    }, [setCollections])

    const renderInterior = () => {
        if (!collections)
            return (
                <p className="span-cols-12">
                    No charts were added to this collection. Did you mean to
                    view{" "}
                    <a href={`${baseUrl}/shared-collection`}>
                        your own collection
                    </a>
                    ?
                </p>
            )

        return (
            <div className="grid span-cols-12">
                {collections.split(" ").map((chartSlug) => (
                    <iframe
                        key={chartSlug}
                        className="span-cols-6"
                        style={{
                            width: "100%",
                            height: 650,
                            marginBottom: 48,
                        }}
                        src={`${baseUrl}/grapher/${chartSlug}`}
                    />
                ))}
            </div>
        )
    }

    return (
        <>
            <h1 className="display-1-semibold span-cols-12 collection-title">
                Shared Collection
            </h1>
            <p className="span-cols-8 collection-explanation">
                This page is displaying a selection of charts that has been
                configured via the URL. Any changes that you make to the charts
                will update the URL so that you can easily share it again.
                (TODO)
            </p>
            {/* TODO: Add Algolia search to add new charts? */}
            {renderInterior()}
        </>
    )
}

export function hydrateSharedCollectionsPage() {
    const container = document.querySelector(
        `#${COLLECTIONS_PAGE_CONTAINER_ID}`
    )
    ReactDOM.hydrate(<SharedCollection baseUrl={BAKED_BASE_URL} />, container)
}
