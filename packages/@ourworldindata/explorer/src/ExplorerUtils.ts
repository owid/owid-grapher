import * as _ from "lodash-es"
import { SelectionArray } from "@ourworldindata/grapher"
import { Bounds, deserializeJSONFromHTML } from "@ourworldindata/utils"
import {
    EMBEDDED_EXPLORER_DELIMITER,
    EMBEDDED_EXPLORER_GRAPHER_CONFIGS,
    EMBEDDED_EXPLORER_PARTIAL_GRAPHER_CONFIGS,
    EMBEDDED_EXPLORER_VIEW_CONFIG_IDS,
    EXPLORER_CONSTANTS_DELIMITER,
} from "./ExplorerConstants.js"
import { ExplorerProps } from "./Explorer.js"

export async function buildExplorerProps(
    html: string,
    queryStr: string,
    selection?: SelectionArray,
    bounds?: Bounds
) {
    const explorerConstants = deserializeJSONFromHTML(
        html,
        EXPLORER_CONSTANTS_DELIMITER
    )
    let grapherConfigs = deserializeJSONFromHTML(
        html,
        EMBEDDED_EXPLORER_GRAPHER_CONFIGS
    )
    let partialGrapherConfigs = deserializeJSONFromHTML(
        html,
        EMBEDDED_EXPLORER_PARTIAL_GRAPHER_CONFIGS
    )
    const chartConfigIdByViewId = deserializeJSONFromHTML(
        html,
        EMBEDDED_EXPLORER_VIEW_CONFIG_IDS
    ) as Record<string, string> | undefined
    if (_.isArray(grapherConfigs)) {
        grapherConfigs = grapherConfigs.map((grapherConfig) => ({
            ...grapherConfig,
            adminBaseUrl: explorerConstants.adminBaseUrl,
            bakedGrapherURL: explorerConstants.bakedGrapherUrl,
        }))
    }
    if (_.isArray(partialGrapherConfigs)) {
        partialGrapherConfigs = partialGrapherConfigs.map((grapherConfig) => ({
            ...grapherConfig,
            adminBaseUrl: explorerConstants.adminBaseUrl,
            bakedGrapherURL: explorerConstants.bakedGrapherUrl,
        }))
    }
    const props: ExplorerProps = {
        ...deserializeJSONFromHTML(html, EMBEDDED_EXPLORER_DELIMITER),
        isEmbeddedInAnOwidPage: true,
        adminBaseUrl: explorerConstants.adminBaseUrl,
        bakedBaseUrl: explorerConstants.bakedBaseUrl,
        bakedGrapherUrl: explorerConstants.bakedGrapherUrl,
        dataApiUrl: explorerConstants.dataApiUrl,
        catalogUrl: explorerConstants.catalogUrl,
        grapherConfigs,
        partialGrapherConfigs,
        chartConfigIdByViewId,
        queryStr,
        selection: new SelectionArray(selection?.selectedEntityNames ?? []),
        bounds: bounds,
        staticBounds: bounds,
    }
    return props
}
