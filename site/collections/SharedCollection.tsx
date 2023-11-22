import React from "react"
import ReactDOM from "react-dom"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import {
    COLLECTIONS_PAGE_CONTAINER_ID,
    deserializeJSONFromHTML,
    fetchText,
} from "@ourworldindata/utils"
import {
    IReactionDisposer,
    ObservableMap,
    computed,
    observable,
    reaction,
} from "mobx"
import { observer } from "mobx-react"
import { Grapher, GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faX } from "@fortawesome/free-solid-svg-icons"

interface SharedCollectionProps {
    baseUrl: string
    initialSharedCollection?: string
}

@observer
export class SharedCollection extends React.Component<SharedCollectionProps> {
    @observable initialSharedCollection =
        this.props.initialSharedCollection || ""
    @observable grapherConfigs: GrapherProgrammaticInterface[] = []
    // @observable graphers: Grapher[] = []
    disposers: IReactionDisposer[] = []

    componentDidMount(): void {
        const slugs = this.initialSharedCollection.split(" ")
        // fetch all grapher configs
        Promise.all(
            slugs.map((slug) =>
                fetchText(`${this.props.baseUrl}/grapher/${slug}`).then(
                    (html) => {
                        const grapherConfig = deserializeJSONFromHTML(html)
                        this.grapherConfigs.push(grapherConfig)
                        // this.graphers.push(new Grapher(grapherConfig))
                    }
                )
            )
        ).then(() => {
            for (const grapherConfig of this.grapherConfigs) {
                const container = document.querySelector(
                    `figure[data-grapher-src="${grapherConfig.slug}"]`
                )
                if (container) {
                    Grapher.renderGrapherIntoContainer(grapherConfig, container)
                }
            }
        })
    }

    componentDidUpdate(): void {}

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
                {this.grapherConfigs.map((grapherConfig, index) => (
                    <div key={index} className="span-cols-6 span-md-cols-12">
                        <figure
                            data-grapher-src={grapherConfig.slug}
                            data-grapher-index={index}
                        />
                        <button
                            className="remove-from-collection-button"
                            onClick={() => {}}
                        >
                            <FontAwesomeIcon icon={faX} />
                            Remove from collection
                        </button>
                    </div>
                ))}
            </div>
        )
    }

    render() {
        return <>{this.renderInterior()}</>
    }
}

export function hydrateSharedCollectionsPage() {
    const container = document.querySelector(
        `#${COLLECTIONS_PAGE_CONTAINER_ID}`
    )
    const urlParams = new URLSearchParams(window.location.search)
    const initialSharedCollection = urlParams.get("charts") || ""

    ReactDOM.hydrate(
        <SharedCollection
            baseUrl={BAKED_BASE_URL}
            initialSharedCollection={initialSharedCollection}
        />,
        container
    )
}
