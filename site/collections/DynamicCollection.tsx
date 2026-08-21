import cx from "clsx"
import * as React from "react"
import {
    IReactionDisposer,
    computed,
    observable,
    reaction,
    makeObservable,
} from "mobx"
import { observer } from "mobx-react"
import { WindowGraphers } from "./DynamicCollectionPage.js"
import { GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import GrapherImage from "../GrapherImage.js"

interface DynamicCollectionProps {
    baseUrl: string
    initialDynamicCollection?: string
}

@observer
export class DynamicCollection extends React.Component<DynamicCollectionProps> {
    initialDynamicCollection: string | undefined =
        this.props.initialDynamicCollection
    graphers: undefined | WindowGraphers = undefined
    pollInterval: null | ReturnType<typeof setInterval> = null
    disposers: IReactionDisposer[] = []

    constructor(props: DynamicCollectionProps) {
        super(props)

        makeObservable(this, {
            initialDynamicCollection: observable,
            graphers: observable,
        })
    }

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
                    `${grapher.grapherState.slug}${grapher.grapherState.queryStr}`
                )
            }
        }

        return slugsAndQueryStrings
    }

    override componentDidMount() {
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
                    }/collection/custom?charts=${allGrapherSlugsAndQueryStrings.join(
                        "+"
                    )}`
                    history.replaceState({}, "", newUrl)
                }
            )
        )
    }

    renderInterior = () => {
        if (!this.initialDynamicCollection)
            return (
                <p className="span-cols-12">
                    No charts were added to this collection.
                    {/* TODO: Algolia search? */}
                </p>
            )
        return (
            <div className="grid span-cols-12">
                {this.initialDynamicCollection
                    .split(" ")
                    .map((chartSlug, index) => {
                        const grapherUrl = `${this.props.baseUrl}/grapher/${chartSlug}`
                        return (
                            <figure
                                key={index}
                                className={cx(
                                    GRAPHER_PREVIEW_CLASS,
                                    "span-cols-6 span-md-cols-12"
                                )}
                                data-grapher-src={grapherUrl}
                                data-grapher-index={index}
                            >
                                <a href={grapherUrl}>
                                    <GrapherImage slug={chartSlug} />
                                </a>
                            </figure>
                        )
                    })}
            </div>
        )
    }

    override render() {
        return (
            <>
                {/* TODO: Add Algolia search to add new charts? */}
                {this.renderInterior()}
            </>
        )
    }
}
