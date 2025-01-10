import { useRef } from "react"

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
    config?: Partial<GrapherProgrammaticInterface>
    queryStr?: string
}

export function GrapherFigureView(props: GrapherFigureViewProps): JSX.Element {
    const slug = props.slug

    const base = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(base)

    const config: GrapherProgrammaticInterface = {
        ...props.config,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        adminBaseUrl: ADMIN_BASE_URL,
        bounds,
        queryStr: props.queryStr ?? window.location.search,
        enableKeyboardShortcuts: true,
    }

    return (
        <figure data-grapher-component ref={base}>
            {bounds && (
                <FetchingGrapher
                    config={config}
                    configUrl={
                        slug
                            ? `${GRAPHER_DYNAMIC_CONFIG_URL}/${slug}.config.json`
                            : undefined
                    }
                    dataApiUrl={DATA_API_URL}
                />
            )}
        </figure>
    )
}
