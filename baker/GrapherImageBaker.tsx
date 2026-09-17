import { GrapherInterface } from "@ourworldindata/types"
import {
    fetchInputTableForConfig,
    Grapher,
    GrapherState,
    GRAPHER_IMAGE_WIDTH_2X,
} from "@ourworldindata/grapher"
import { runInAction } from "mobx"
import { DATA_API_URL } from "../settings/serverSettings.js"
import ReactDOMServer from "react-dom/server"
import sharp from "sharp"

export async function grapherToSVG(
    jsonConfig: GrapherInterface
    // vardata: MultipleOwidVariableDataDimensionsMap
): Promise<string> {
    const grapher = new Grapher({
        grapherState: new GrapherState({
            ...jsonConfig,
        }),
    })
    runInAction(() => {
        grapher.grapherState.isExportingToSvgOrPng = true
        grapher.grapherState.shouldIncludeDetailsInStaticExport = false
    })
    // grapher.receiveOwidData(vardata)
    const inputTable = await fetchInputTableForConfig({
        dimensions: jsonConfig.dimensions ?? [],
        selectedEntityColors: jsonConfig.selectedEntityColors,
        dataApiUrl: DATA_API_URL,
        noCache: false,
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable
    return grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
}

// NOTE: To ensure the correct fonts are used in the generated PNG, the fonts
// referenced in the SVG must be installed locally.
export async function grapherToPng(
    jsonConfig: GrapherInterface,
    width: number = GRAPHER_IMAGE_WIDTH_2X
): Promise<Buffer> {
    const svg = await grapherToSVG(jsonConfig)
    return await sharp(Buffer.from(svg), { density: 144 })
        .png()
        .resize(width)
        .flatten({ background: "#ffffff" })
        .toBuffer()
}
