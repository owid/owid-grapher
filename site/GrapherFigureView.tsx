import { action, observable } from "mobx"
import { observer } from "mobx-react"
import React from "react"

import { Grapher, GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import { Bounds } from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"

// Wrapper for Grapher that uses css on figure element to determine the bounds
@observer
export class GrapherFigureView extends React.Component<{ grapher: Grapher }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref bounds?: Bounds

    @action.bound calcBounds() {
        this.bounds = Bounds.fromRect(
            this.base.current!.getBoundingClientRect()
        )
    }

    componentDidMount() {
        window.addEventListener("resize", this.calcBounds)
        this.calcBounds()
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.calcBounds)
    }

    render() {
        const { grapher } = this.props

        const props: GrapherProgrammaticInterface = {
            ...grapher.toObject(),
            isEmbeddedInADataPage: grapher.isEmbeddedInADataPage,
            bindUrlToWindow: grapher.props.bindUrlToWindow,
            queryStr: grapher.props.bindUrlToWindow
                ? window.location.search
                : undefined,
            bounds: this.bounds,
            dataApiUrl: DATA_API_URL,
            dataApiUrlForAdmin:
                this.context?.admin?.settings?.DATA_API_FOR_ADMIN_UI, // passed this way because clientSettings are baked and need a recompile to be updated
        }
        return (
            // They key= in here makes it so that the chart is re-loaded when the slug changes.
            // This is especially important for SearchResults, where the preview chart can change as
            // the search query changes.
            <figure data-grapher-src ref={this.base}>
                {this.bounds && (
                    <Grapher
                        key={props.slug}
                        {...props}
                        adminBaseUrl={ADMIN_BASE_URL}
                        bakedGrapherURL={BAKED_GRAPHER_URL}
                    />
                )}
            </figure>
        )
    }
}
