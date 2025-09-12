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
    useProvidedConfigOnly?: boolean // If true, will not fetch config from URL
    queryStr?: string
    isEmbeddedInAnOwidPage: boolean
    isEmbeddedInADataPage: boolean
    isPreviewing?: boolean
}

export function GrapherFigureView(
    props: GrapherFigureViewProps
): React.ReactElement {
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

    if (props.configUrl && props.useProvidedConfigOnly) {
        throw new Error(
            "useProvidedConfigOnly is true, but configUrl has been provided. This will not work as expected."
        )
    }

    const slugConfigUrl = slug
        ? `${GRAPHER_DYNAMIC_CONFIG_URL}/${slug}.config.json${props.isPreviewing ? "?nocache" : ""}`
        : undefined

    const configUrl = !props.useProvidedConfigOnly
        ? (props.configUrl ?? slugConfigUrl)
        : undefined

    return (
        <figure className="chart grapher-component" ref={base}>
            {bounds && (
                <FetchingGrapher
                    config={config}
                    configUrl={configUrl}
                    dataApiUrl={DATA_API_URL}
                    archiveContext={config.archiveContext}
                    queryStr={props.queryStr}
                    externalBounds={bounds}
                    noCache={props.isPreviewing}
                />
            )}
        </figure>
    )
}
