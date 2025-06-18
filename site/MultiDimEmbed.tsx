import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import {
    Url,
    fetchWithRetry,
    searchParamsToMultiDimView,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { useState, useEffect } from "react"
import {
    MULTI_DIM_DYNAMIC_CONFIG_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
} from "../settings/clientSettings.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import MultiDim from "./multiDim/MultiDim.js"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"

interface MultiDimEmbedProps {
    url: string
    chartConfig: Partial<GrapherProgrammaticInterface>
}

export const MultiDimEmbed: React.FC<MultiDimEmbedProps> = (
    props: MultiDimEmbedProps
) => {
    const { url } = props
    const [config, setConfig] = useState<MultiDimDataPageConfigEnriched | null>(
        null
    )
    const [error, setError] = useState<string | null>(null)

    const embedUrl = Url.fromURL(url)
    const { queryStr, slug } = embedUrl

    useEffect(() => {
        let ignore = false
        if (!slug) {
            setError("No slug found in URL")
            return
        }

        const fetchConfig = async () => {
            try {
                const mdimConfigUrl = `${MULTI_DIM_DYNAMIC_CONFIG_URL}/${slug}.json`
                const multiDimConfig = await fetchWithRetry(mdimConfigUrl).then(
                    (res) => res.json()
                )
                if (ignore) return
                setConfig(multiDimConfig)
            } catch {
                setError("Failed to load chart configuration")
            }
        }

        void fetchConfig()

        return () => {
            ignore = true
        }
    }, [slug])

    if (error) {
        return <div>Error: {error}</div>
    }

    if (!config || !slug) {
        return <div>Loading...</div>
    }

    if (embedUrl.queryParams.hideControls === "true") {
        const view = searchParamsToMultiDimView(
            config,
            new URLSearchParams(queryStr)
        )
        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${view.fullConfigId}.config.json`

        return (
            <GrapherWithFallback
                configUrl={configUrl}
                queryStr={queryStr}
                config={props.chartConfig}
                isEmbeddedInAnOwidPage={true}
                isEmbeddedInADataPage={false}
            />
        )
    }

    return (
        <MultiDim
            slug={slug}
            config={MultiDimDataPageConfig.fromObject(config)}
            localGrapherConfig={props.chartConfig}
            queryStr={queryStr}
        />
    )
}
