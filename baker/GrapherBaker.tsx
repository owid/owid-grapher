import * as React from "react"
import { JsonError } from "serverUtils/serverUtil"
import { Chart } from "db/model/Chart"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { GrapherPage } from "site/server/views/GrapherPage"
import { renderToHtmlPage } from "site/server/siteRenderers"
import { Post } from "db/model/Post"
import { urlToSlug, without } from "clientUtils/Util"
import { isPresent } from "clientUtils/isPresent"
import { getRelatedCharts } from "db/wpdb"
import { getVariableData } from "db/model/Variable"
import * as fs from "fs-extra"
import { deserializeJSONFromHTML } from "clientUtils/serializers"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker"
import { OPTIMIZE_SVG_EXPORTS } from "settings"
import ProgressBar = require("progress")
import * as db from "db/db"
import * as glob from "glob"
import { hasLegacyGrapherToCovidExplorerRedirect } from "explorerAdmin/legacyCovidExplorerRedirects"

export async function grapherConfigToHtmlPage(grapher: GrapherInterface) {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await Post.bySlug(postSlug) : undefined
    const relatedCharts = post ? await getRelatedCharts(post.id) : undefined
    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
            relatedCharts={relatedCharts}
        />
    )
}

export async function grapherSlugToHtmlPage(slug: string) {
    const entity = await Chart.getBySlug(slug)
    if (!entity) throw new JsonError("No such chart", 404)
    return grapherConfigToHtmlPage(entity.config)
}

const bakeVariableData = async (
    bakedSiteDir: string,
    variableIds: number[],
    outPath: string
): Promise<string> => {
    await fs.mkdirp(`${bakedSiteDir}/grapher/data/variables/`)
    const vardata = await getVariableData(variableIds)
    await fs.writeFile(outPath, JSON.stringify(vardata))
    console.log(outPath)
    return vardata
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
        if (err.code !== "ENOENT") console.error(err)
    }

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(outPath, await grapherConfigToHtmlPage(grapher))
    console.log(outPath)

    const variableIds = lodash.uniq(
        grapher.dimensions?.map((d) => d.variableId)
    )
    if (!variableIds.length) return

    // Make sure we bake the variables successfully before outputing the chart html
    const vardataPath = `${bakedSiteDir}/grapher/data/variables/${variableIds.join(
        "+"
    )}.json`
    if (!isSameVersion || !fs.existsSync(vardataPath)) {
        await bakeVariableData(bakedSiteDir, variableIds, vardataPath)
    }

    try {
        await fs.mkdirp(`${bakedSiteDir}/grapher/exports/`)
        const svgPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.svg`
        const pngPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.png`
        if (
            !isSameVersion ||
            !fs.existsSync(svgPath) ||
            !fs.existsSync(pngPath)
        ) {
            const vardata = JSON.parse(await fs.readFile(vardataPath, "utf8"))
            await bakeGraphersToPngs(
                `${bakedSiteDir}/grapher/exports`,
                grapher,
                vardata,
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

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers = async (
    bakedSiteDir: string
) => {
    const rows: { id: number; config: any }[] = await db.query(
        `SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true ORDER BY JSON_EXTRACT(config, "$.slug") ASC`
    )

    const newSlugs = []
    await fs.mkdirp(bakedSiteDir + "/grapher")
    const progressBar = new ProgressBar(
        "BakeGrapherPageVarPngAndSVGIfChanged [:bar] :current/:total :elapseds :name\n",
        {
            width: 20,
            total: rows.length + 1,
        }
    )
    for (const row of rows) {
        const grapher: GrapherInterface = JSON.parse(row.config)
        grapher.id = row.id
        newSlugs.push(grapher.slug)

        // todo: eventually remove
        if (hasLegacyGrapherToCovidExplorerRedirect(row.id)) {
            progressBar.tick({ name: `✅ ${grapher.slug}` })
            continue
        }

        await bakeGrapherPageAndVariablesPngAndSVGIfChanged(
            bakedSiteDir,
            grapher
        )
        progressBar.tick({ name: `✅ ${grapher.slug}` })
    }

    await deleteOldGraphers(bakedSiteDir, newSlugs.filter(isPresent))
    progressBar.tick({ name: `✅ Deleted old graphers` })
}
