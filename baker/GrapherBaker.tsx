import React from "react"
import { Chart } from "../db/model/Chart.js"
import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import { GrapherPage } from "../site/GrapherPage.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import { excludeUndefined, urlToSlug, without } from "../clientUtils/Util.js"
import {
    getRelatedArticles,
    getRelatedCharts,
    isWordpressAPIEnabled,
    isWordpressDBEnabled,
} from "../db/wpdb.js"
import { getVariableData } from "../db/model/Variable.js"
import * as fs from "fs-extra"
import { deserializeJSONFromHTML } from "../clientUtils/serializers.js"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import * as glob from "glob"
import { JsonError } from "../clientUtils/owidTypes.js"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { getPostBySlug } from "../db/model/Post.js"
import {
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
} from "../clientUtils/OwidVariable.js"
import {
    GRAPHER_VARIABLES_ROUTE,
    GRAPHER_VARIABLE_DATA_ROUTE,
    GRAPHER_VARIABLE_METADATA_ROUTE,
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "../grapher/core/GrapherConstants.js"
import workerpool from "workerpool"

const grapherConfigToHtmlPage = async (grapher: GrapherInterface) => {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await getPostBySlug(postSlug) : undefined
    const relatedCharts =
        post && isWordpressDBEnabled
            ? await getRelatedCharts(post.id)
            : undefined
    const relatedArticles =
        grapher.id && isWordpressAPIEnabled
            ? await getRelatedArticles(grapher.id)
            : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

export const grapherSlugToHtmlPage = async (slug: string) => {
    const entity = await Chart.getBySlug(slug)
    if (!entity) throw new JsonError("No such chart", 404)
    return grapherConfigToHtmlPage(entity.config)
}

interface BakeVariableDataArguments {
    bakedSiteDir: string
    variableId: number
}

export const bakeVariableData = async (
    bakeArgs: BakeVariableDataArguments
): Promise<void> => {
    await fs.mkdirp(`${bakeArgs.bakedSiteDir}${GRAPHER_VARIABLES_ROUTE}`)
    await fs.mkdirp(`${bakeArgs.bakedSiteDir}${GRAPHER_VARIABLE_DATA_ROUTE}`)
    await fs.mkdirp(
        `${bakeArgs.bakedSiteDir}${GRAPHER_VARIABLE_METADATA_ROUTE}`
    )

    const variableData = await getVariableData(bakeArgs.variableId)
    const { data, metadata } = variableData
    const path = `${bakeArgs.bakedSiteDir}${getVariableDataRoute(
        bakeArgs.variableId
    )}`
    const metadataPath = `${bakeArgs.bakedSiteDir}${getVariableMetadataRoute(
        bakeArgs.variableId
    )}`
    await fs.writeFile(path, JSON.stringify(data))
    await fs.writeFile(metadataPath, JSON.stringify(metadata))
    console.log(path)
    console.log(metadataPath)
}

const bakeGrapherPageAndVariablesPngAndSVGIfChanged = async (
    bakedSiteDir: string,
    grapher: GrapherInterface
) => {
    const htmlPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    let isSameVersion = false
    try {
        // If the chart is the same version, we can potentially skip baking the data and exports (which is by far the slowest part)
        const html = await fs.readFile(htmlPath, "utf8")
        const savedVersion = deserializeJSONFromHTML(html)
        isSameVersion = savedVersion?.version === grapher.version
    } catch (err) {
        if ((err as any).code !== "ENOENT") console.error(err)
    }

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(outPath, await grapherConfigToHtmlPage(grapher))
    console.log(outPath)

    const variableIds = lodash.uniq(
        grapher.dimensions?.map((d) => d.variableId)
    )
    if (!variableIds.length) return

    try {
        await fs.mkdirp(`${bakedSiteDir}/grapher/exports/`)
        const svgPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.svg`
        const pngPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.png`
        if (
            !isSameVersion ||
            !fs.existsSync(svgPath) ||
            !fs.existsSync(pngPath)
        ) {
            const loadDataMetadataPromises: Promise<OwidVariableDataMetadataDimensions>[] =
                variableIds.map(async (variableId) => {
                    const metadataPath = `${bakedSiteDir}${getVariableMetadataRoute(
                        variableId
                    )}`
                    const metadataString = await fs.readFile(
                        metadataPath,
                        "utf8"
                    )
                    const metadataJson = JSON.parse(
                        metadataString
                    ) as OwidVariableWithSourceAndDimension
                    const dataPath = `${bakedSiteDir}${getVariableDataRoute(
                        variableId
                    )}`
                    const dataString = await fs.readFile(dataPath, "utf8")
                    const dataJson = JSON.parse(
                        dataString
                    ) as OwidVariableMixedData
                    return {
                        data: dataJson,
                        metadata: metadataJson,
                    }
                })
            const variableDataMetadata = await Promise.all(
                loadDataMetadataPromises
            )
            const variableDataMedadataMap = new Map(
                variableDataMetadata.map((item) => [item.metadata.id, item])
            )
            await bakeGraphersToPngs(
                `${bakedSiteDir}/grapher/exports`,
                grapher,
                variableDataMedadataMap,
                OPTIMIZE_SVG_EXPORTS
            )
            console.log(svgPath)
            console.log(pngPath)
        }
    } catch (err) {
        console.error(err)
    }
}

const deleteOldGraphers = async (bakedSiteDir: string, newSlugs: string[]) => {
    // Delete any that are missing from the database
    const oldSlugs = glob
        .sync(`${bakedSiteDir}/grapher/*.html`)
        .map((slug) =>
            slug.replace(`${bakedSiteDir}/grapher/`, "").replace(".html", "")
        )
    const toRemove = without(oldSlugs, ...newSlugs)
        // do not delete grapher slugs redirected to explorers
        .filter((slug) => !isPathRedirectedToExplorer(`/grapher/${slug}`))
    for (const slug of toRemove) {
        console.log(`DELETING ${slug}`)
        try {
            const paths = [
                `${bakedSiteDir}/grapher/${slug}.html`,
                `${bakedSiteDir}/grapher/exports/${slug}.png`,
            ] //, `${BAKED_SITE_DIR}/grapher/exports/${slug}.svg`]
            await Promise.all(paths.map((p) => fs.unlink(p)))
            paths.map((p) => console.log(p))
        } catch (err) {
            console.error(err)
        }
    }
}

const bakeAllPublishedChartsVariableDataAndMetadata = async (
    bakedSiteDir: string,
    variableIds: number[]
) => {
    // TODO: figure out if rebake is necessary by checking the version of the data/metadata
    const pool = workerpool.pool(__dirname + "/worker.js", {
        minWorkers: 2,
    })
    const jobs = variableIds.map((variableId) => ({
        bakedSiteDir: bakedSiteDir,
        variableId: variableId,
    }))

    await Promise.all(jobs.map((job) => pool.exec("bakeVariableData", [job])))
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments
) => {
    const grapher: GrapherInterface = JSON.parse(args.config)
    grapher.id = args.id

    // Avoid baking paths that have an Explorer redirect.
    // Redirects take precedence.
    if (isPathRedirectedToExplorer(`/grapher/${grapher.slug}`)) {
        console.log({
            name: `⏩ ${grapher.slug} redirects to explorer`,
        })
        return
    }

    await bakeGrapherPageAndVariablesPngAndSVGIfChanged(
        args.bakedSiteDir,
        grapher
    )
    console.log({ name: `✅ ${grapher.slug}` })
}

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers =
    async (bakedSiteDir: string) => {
        const variablesToBake: { varId: number }[] =
            await db.queryMysql(`select distinct vars.varID as varId
from
charts c,
json_table(c.config, '$.dimensions[*]' columns (varID integer path '$.variableId') ) as vars
where JSON_EXTRACT(c.config, '$.isPublished')=true`)

        bakeAllPublishedChartsVariableDataAndMetadata(
            bakedSiteDir,
            variablesToBake.map((v) => v.varId)
        )

        const rows: { id: number; config: any }[] = await db.queryMysql(
            `SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true ORDER BY JSON_EXTRACT(config, "$.slug") ASC`
        )

        const newSlugs = rows.map((row) => row.config.slug)
        await fs.mkdirp(bakedSiteDir + "/grapher")
        const jobs = rows.map((row) => ({
            id: row.id,
            config: row.config,
            bakedSiteDir: bakedSiteDir,
        }))
        const pool = workerpool.pool(__dirname + "/worker.js", {
            minWorkers: 2,
        })
        await Promise.all(
            jobs.map((job) => pool.exec("bakeSingleGrapherChart", [job]))
        )

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        console.log({ name: `✅ Deleted old graphers` })
    }
