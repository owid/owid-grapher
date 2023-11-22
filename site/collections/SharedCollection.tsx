import React from "react"
import ReactDOM from "react-dom"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { COLLECTIONS_PAGE_CONTAINER_ID } from "@ourworldindata/utils"
import {
    IReactionDisposer,
    ObservableMap,
    computed,
    observable,
    reaction,
} from "mobx"
import { observer } from "mobx-react"
import { WindowGraphers } from "./CollectionsPage.js"
import { Grapher } from "@ourworldindata/grapher"

interface SharedCollectionProps {
    baseUrl: string
    initialSharedCollection?: string
}

/**
 * After the MultiEmbedder has mounted a Grapher, we poll grapherRef until grapherRef.current is defined,
 * and then update the window.graphers Map with it.
 *
 * This is what allows us to use a reaction in the SharedCollection component to update the URL whenever a Grapher is updated.
 */
export function embedSharedCollectionGrapher(
    grapherRef: React.RefObject<Grapher>,
    figure: Element
) {
    const interval = setInterval(() => {
        if (grapherRef.current) {
            const originalSlug =
                grapherRef.current.slug + grapherRef.current.queryStr

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

@observer
export class SharedCollection extends React.Component<SharedCollectionProps> {
    @observable initialSharedCollection? = this.props.initialSharedCollection
    @observable graphers: undefined | WindowGraphers = undefined
    pollInterval: null | ReturnType<typeof setInterval> = null
    disposers: IReactionDisposer[] = []

    @computed get allGrapherSlugsAndQueryStrings() {
        if (!this.graphers) return []

        // If the grapher hasn't mounted yet, we use the original slugAndQueryString
        // This allows us to update the URL if users interact with graphers that have mounted
        // while still keeping the unmounted graphers in the URL in the right place
        const slugsAndQueryStrings = new Array(this.graphers.size)

        for (const [originalSlugAndUrl, { index, grapher }] of this.graphers) {
            if (!grapher) {
                // Strip index suffix from originalSlugAndUrl
                const withoutIndex = originalSlugAndUrl.replace(/-\d+$/, "")
                slugsAndQueryStrings[index] = encodeURIComponent(withoutIndex)
            } else {
                slugsAndQueryStrings[index] = encodeURIComponent(
                    `${grapher.slug}${grapher.queryStr}`
                )
            }
        }

        return slugsAndQueryStrings
    }

    componentDidMount() {
        this.pollInterval = setInterval(this.pollForGraphers, 1000)
    }

    pollForGraphers = () => {
        if (typeof window !== "undefined" && window.graphers) {
            this.graphers = window.graphers
            clearInterval(this.pollInterval!)
            this.setupReaction()
        }
    }

    setupReaction = () => {
        this.disposers.push(
            reaction(
                () => this.allGrapherSlugsAndQueryStrings,
                (allGrapherSlugsAndQueryStrings: string[]) => {
                    const newUrl = `${
                        this.props.baseUrl
                    }/shared-collection?charts=${allGrapherSlugsAndQueryStrings.join(
                        "+"
                    )}`
                    history.replaceState({}, "", newUrl)
                }
            )
        )
    }

    renderInterior = () => {
        if (!this.initialSharedCollection)
            return (
                <p className="span-cols-12">
                    No charts were added to this collection.
                    {/* TODO: Algolia search? */}
                </p>
            )
        return (
            <div className="grid span-cols-12">
                {this.initialSharedCollection
                    .split(" ")
                    .map((chartSlug, index) => (
                        <figure
                            key={chartSlug}
                            data-grapher-src={`${this.props.baseUrl}/grapher/${chartSlug}`}
                            data-grapher-index={index}
                            className="span-cols-6 span-md-cols-12"
                        />
                    ))}
            </div>
        )
    }

    render() {
        return (
            <>
                {/* TODO: Add Algolia search to add new charts? */}
                {this.renderInterior()}
            </>
        )
    }
}

export function hydrateSharedCollectionsPage() {
    const container = document.querySelector(
        `#${COLLECTIONS_PAGE_CONTAINER_ID}`
    )
    const urlParams = new URLSearchParams(window.location.search)
    const initialSharedCollection = urlParams.get("charts") || ""
    window.graphers = new ObservableMap()
    const entries = initialSharedCollection.split(" ").entries()
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
    ReactDOM.hydrate(
        <SharedCollection
            baseUrl={BAKED_BASE_URL}
            initialSharedCollection={initialSharedCollection}
        />,
        container
    )
}
