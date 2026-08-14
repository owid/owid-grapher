import * as React from "react"
import ReactDOM from "react-dom/client"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { DYNAMIC_COLLECTION_PAGE_CONTAINER_ID } from "@ourworldindata/utils"
import { ObservableMap, observable } from "mobx"
import { Grapher } from "@ourworldindata/grapher"
import { DynamicCollection } from "./DynamicCollection.js"

/**
 * After the MultiEmbedder has mounted a Grapher, we poll grapherRef until grapherRef.current is defined,
 * and then update the window.graphers Map with it.
 *
 * This is what allows us to use a reaction in the DynamicCollection component to update the URL whenever a Grapher is updated.
 */
export function embedDynamicCollectionGrapher(
    grapherRef: React.RefObject<Grapher | null>,
    figure: Element
) {
    const interval = setInterval(() => {
        if (grapherRef.current) {
            const originalSlug =
                grapherRef.current.grapherState.slug +
                grapherRef.current.grapherState.queryStr

            const index = figure.getAttribute("data-grapher-index")

            const windowGrapher = window.graphers.get(
                `${originalSlug}-${index}`
            )

            if (windowGrapher) {
                windowGrapher.grapher = grapherRef.current
            }
            clearInterval(interval)
        }
    }, 1000)
}

export function hydrateDynamicCollectionPage() {
    const container = document.querySelector(
        `#${DYNAMIC_COLLECTION_PAGE_CONTAINER_ID}`
    )
    if (!container) {
        console.error(
            `Could not find container with id ${DYNAMIC_COLLECTION_PAGE_CONTAINER_ID}`
        )
        return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const initialDynamicCollection = urlParams.get("charts") || ""
    window.graphers = new ObservableMap()
    const entries = initialDynamicCollection.split(" ").entries()
    for (const [index, chartSlug] of entries) {
        window.graphers.set(
            // Include index in the key so that we can have multiple of the same chart
            // This gets tracked in the DOM via data-grapher-index, so that the MultiEmbedder can update the correct object
            // when the grapher mounts
            `${chartSlug}-${index}`,
            observable({
                index,
                grapher: undefined,
            })
        )
    }
    ReactDOM.hydrateRoot(
        container,
        <DynamicCollection
            baseUrl={BAKED_BASE_URL}
            initialDynamicCollection={initialDynamicCollection}
        />
    )
}
