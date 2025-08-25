import ReactDOMServer from "react-dom/server"
import { Env, extensions } from "./env.js"
import { extractOptions, ImageOptions } from "./imageOptions.js"
import {
    buildExplorerProps,
    Explorer,
    ExplorerChoiceParams,
} from "@ourworldindata/explorer"
import { renderSvgToPng } from "./grapherRenderer.js"
import { error, png } from "itty-router"
import { createZip, File } from "littlezipper"
import { Bounds, Url } from "@ourworldindata/utils"
import {
    getSelectedEntityNamesParam,
    GrapherState,
    migrateSelectedEntityNamesParam,
    SelectionArray,
} from "@ourworldindata/grapher"
import {
    assembleCsv,
    assembleDataValues,
    assembleReadme,
    ensureDownloadOfDataAllowed,
    findEntityForExtractingDataValues,
    prepareSearchParamsBeforeExtractingDataValues,
} from "./downloadFunctions.js"
import { assembleMetadata } from "./metadataTools.js"

async function initGrapherForExplorerView(
    env: Env,
    options: ImageOptions
): Promise<{
    grapherState: GrapherState
    explorerParams: ExplorerChoiceParams
}> {
    const url = env.url
    const explorerPage = await env.ASSETS.fetch(url, { redirect: "manual" })

    const html = await explorerPage.text()
    const queryStr = url.searchParams.toString()
    // The env URL class isn't compatible with the Url class from @ourworldindata/utils
    const urlObj = Url.fromURL(url.toString())
    const windowEntityNames = getSelectedEntityNamesParam(
        migrateSelectedEntityNamesParam(urlObj)
    )

    const selection = new SelectionArray(windowEntityNames)
    const bounds = new Bounds(0, 0, options.svgWidth, options.svgHeight)
    const explorerProps = await buildExplorerProps(
        html,
        queryStr,
        selection,
        bounds
    )
    const explorer = new Explorer(explorerProps)
    await explorer.updateGrapherFromExplorer()
    explorer.grapherState.populateFromQueryParams(urlObj.queryParams)

    if (options.grapherProps?.isSocialMediaExport)
        explorer.grapherState.isSocialMediaExport =
            options.grapherProps.isSocialMediaExport
    if (options.grapherProps?.variant)
        explorer.grapherState.variant = options.grapherProps.variant
    explorer.grapherState.initialOptions = { baseFontSize: options.fontSize }

    return {
        grapherState: explorer.grapherState,
        explorerParams: explorer.explorerProgram.decisionMatrix.currentParams,
    }
}

export async function handleThumbnailRequestForExplorerView(
    searchParams: URLSearchParams,
    env: Env,
    extension: "png" | "svg"
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(`.${extension}`, "")

    try {
        const { grapherState } = await initGrapherForExplorerView(env, options)
        const svg = grapherState.generateStaticSvg(
            ReactDOMServer.renderToStaticMarkup
        )
        if (extension === "svg") {
            return new Response(svg, {
                headers: {
                    "Content-Type": "image/svg+xml",
                    "Cache-Control": "public, max-age=600",
                },
            })
        } else {
            return png(await renderSvgToPng(svg, options, "#fff"))
        }
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

export async function handleConfigRequestForExplorerView(
    searchParams: URLSearchParams,
    env: Env
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(extensions.configJson, "")

    try {
        const { grapherState } = await initGrapherForExplorerView(env, options)

        const config = grapherState.object
        return new Response(JSON.stringify(config), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

export async function fetchCsvForExplorerView(
    searchParams: URLSearchParams,
    env: Env
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(extensions.csv, "")

    try {
        const { grapherState } = await initGrapherForExplorerView(env, options)

        console.log("checking if download is allowed")
        ensureDownloadOfDataAllowed(grapherState)
        console.log("data download is allowed")

        const csv = assembleCsv(
            grapherState,
            searchParams ?? new URLSearchParams("")
        )
        return new Response(csv, {
            headers: { "Content-Type": "text/csv" },
        })
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

export async function fetchMetadataForExplorerView(
    searchParams: URLSearchParams,
    env: Env
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(extensions.metadata, "")

    try {
        const { grapherState } = await initGrapherForExplorerView(env, options)
        const metadata = assembleMetadata(grapherState, searchParams)
        return Response.json(metadata)
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

export async function fetchReadmeForExplorerView(
    searchParams: URLSearchParams,
    env: Env
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(extensions.readme, "")

    try {
        const { grapherState } = await initGrapherForExplorerView(env, options)
        const readme = assembleReadme(grapherState, searchParams)
        return new Response(readme, {
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
        })
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

export async function fetchZipForExplorerView(
    searchParams: URLSearchParams,
    env: Env
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(extensions.zip, "")

    try {
        const { grapherState, explorerParams } =
            await initGrapherForExplorerView(env, options)

        ensureDownloadOfDataAllowed(grapherState)
        const metadata = assembleMetadata(grapherState, searchParams)
        const readme = assembleReadme(grapherState, searchParams)
        const csv = assembleCsv(grapherState, searchParams)
        console.log("Fetched the parts, creating zip file")

        // Make a unique identifier for the given view
        const explorerSlug = url.pathname.split("/").pop()
        const viewId = Object.values(explorerParams)
            .map((value) => value.replace(/\s/g, "_"))
            .join("__")
        const identifier = `${explorerSlug}__${viewId}`

        const zipContent: File[] = [
            {
                path: `${identifier}.metadata.json`,
                data: JSON.stringify(metadata, undefined, 2),
            },
            { path: `${identifier}.csv`, data: csv },
            { path: "readme.md", data: readme },
        ]
        const content = await createZip(zipContent)
        console.log("Generated content, returning response")

        return new Response(content, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${identifier}.zip"`,
            },
        })
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

export async function fetchDataValuesForExplorerView(
    searchParams: URLSearchParams,
    env: Env
) {
    const options = extractOptions(searchParams)

    const url = env.url
    url.href = url.href.replace(extensions.values, "")

    const entityName = findEntityForExtractingDataValues(url.searchParams)
    prepareSearchParamsBeforeExtractingDataValues(url.searchParams, entityName)

    try {
        const { grapherState } = await initGrapherForExplorerView(env, options)
        const dataValues = assembleDataValues(grapherState, entityName)
        return Response.json(dataValues)
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}
