import { useMemo, useRef } from "react"

import {
    FetchingGrapher,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { useElementBounds } from "./hooks.js"

export interface GrapherFigureViewProps {
    slug?: string
    configUrl?: string
    config?: Partial<GrapherProgrammaticInterface>
    queryStr?: string
    isEmbeddedInAnOwidPage: boolean
    isEmbeddedInADataPage: boolean
}

export function GrapherFigureView(props: GrapherFigureViewProps): JSX.Element {
    const slug = props.slug

    if (!slug && !props.configUrl) {
        console.error(
            "GrapherFigureView requires either a slug or a configUrl to be provided."
        )
    }

    const base = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(base)

    const config: GrapherProgrammaticInterface = useMemo(() => {
        return {
            ...props.config,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            adminBaseUrl: ADMIN_BASE_URL,
            enableKeyboardShortcuts: true,
            isEmbeddedInAnOwidPage: props.isEmbeddedInAnOwidPage,
            isEmbeddedInADataPage: props.isEmbeddedInADataPage,
        }
    }, [
        props.config,
        props.isEmbeddedInAnOwidPage,
        props.isEmbeddedInADataPage,
    ])

    return (
        <figure className="chart grapher-component" ref={base}>
            {bounds && (
                <FetchingGrapher
                    config={config}
                    configUrl={
                        props.configUrl
                            ? props.configUrl
                            : slug
                              ? `${GRAPHER_DYNAMIC_CONFIG_URL}/${slug}.config.json`
                              : undefined
                    }
                    dataApiUrl={DATA_API_URL}
                    archivedChartInfo={config.archivedChartInfo}
                    queryStr={props.queryStr}
                    externalBounds={bounds}
                />
            )}
        </figure>
    )
}
