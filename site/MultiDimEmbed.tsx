import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import {
    Url,
    fetchWithRetry,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { useState, useEffect } from "react"
import { MULTI_DIM_DYNAMIC_CONFIG_URL } from "../settings/clientSettings.js"
import MultiDim from "./multiDim/MultiDim.js"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"

interface MultiDimEmbedProps {
    url: string
    chartConfig: Partial<GrapherProgrammaticInterface>
    isPreviewing?: boolean
}

export const MultiDimEmbed: React.FC<MultiDimEmbedProps> = (
    props: MultiDimEmbedProps
) => {
    const { url, isPreviewing } = props
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
                const mdimConfigUrl = `${MULTI_DIM_DYNAMIC_CONFIG_URL}/${slug}.json${isPreviewing ? "?nocache" : ""}`
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
    }, [isPreviewing, slug])

    if (error) {
        return <div>Error: {error}</div>
    }

    if (!config || !slug) {
        return <div>Loading...</div>
    }

    return (
        <MultiDim
            slug={slug}
            config={MultiDimDataPageConfig.fromObject(config)}
            localGrapherConfig={props.chartConfig}
            queryStr={queryStr}
            isPreviewing={isPreviewing}
        />
    )
}
