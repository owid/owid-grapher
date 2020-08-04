import * as fs from "fs-extra"
import { csvParse } from "d3-dsv"
import md5 from "md5"
import { BAKED_GRAPHER_URL } from "settings"
import React from "react"
import {
    bakeChartToImage,
    getChartsBySlug
} from "site/server/bakeChartsToImages"

const header = `bakeOrder,timeToBake,slug,md5`
const sampleRow = `1,123,world-pop,ee5a6312...`
interface BakedSvgInfo {
    bakeOrder: number
    timeToBake: number
    slug: string
    md5: string
}

const svgResultsPlaceholder = `${header}\n${sampleRow}\n`
const style = {
    width: 600,
    height: 300
}

export const svgCompareFormPage = (
    <form action="" method="post">
        <div>Prod SVG Results CSV</div>
        <textarea
            name="prodResults"
            placeholder={svgResultsPlaceholder}
            style={style}
        />
        <br />
        <div>Local SVG Results CSV</div>
        <textarea
            name="localResults"
            placeholder={svgResultsPlaceholder}
            style={style}
        />
        <br />
        <button type="submit">Compare</button>
    </form>
)

export async function bakeAndSaveResultsFile(
    bakeLimit: number = 100000,
    outDir: string = __dirname + "/bakedSvgs"
) {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    const { chartsBySlug } = await getChartsBySlug()
    const resultsPath = outDir + "/results.csv"
    fs.writeFileSync(resultsPath, header + "\n")
    console.log(header)
    let bakeOrder = 1
    for (const [slug, config] of chartsBySlug) {
        if (bakeOrder > bakeLimit) break
        const startTime = Date.now()
        const svg = await bakeChartToImage(
            config,
            outDir,
            slug,
            undefined,
            undefined,
            true,
            false
        )
        const row = {
            bakeOrder,
            timeToBake: Date.now() - startTime,
            slug,
            md5: md5(svg!)
        }
        const line = `${bakeOrder},${row.timeToBake},${row.slug},${row.md5}`
        console.log(line)
        fs.appendFileSync(resultsPath, line + "\n")
        bakeOrder++
    }
}

const compareSets = (liveSvgs: BakedSvgInfo[], localSvgs: BakedSvgInfo[]) => {
    const localSvgMap = new Map<string, BakedSvgInfo>()
    localSvgs.forEach(svg => {
        localSvgMap.set(svg.slug, svg)
    })
    return liveSvgs.map(liveSvg => {
        const { slug } = liveSvg
        const localSvg = localSvgMap.get(slug)
        if (!localSvg)
            return {
                missing: slug
            }

        const changed = liveSvg.md5 !== localSvg.md5
        const devInteractiveUrl = `${BAKED_GRAPHER_URL}/${slug}`
        const devSvgPath = `${BAKED_GRAPHER_URL}/exports/${slug}.svg`
        const liveInteractiveUrl = `https://ourworldindata.org/grapher/${slug}`
        const liveSvgUrl = `https://ourworldindata.org/grapher/exports/${slug}.svg`
        return {
            changed,
            liveSvgUrl,
            liveInteractiveUrl,
            devSvgPath,
            devInteractiveUrl
        }
    })
}

export const getComparePage = async (liveRows: string, devRows: string) => {
    const live = csvParse(liveRows)
    const dev = csvParse(devRows)
    const files = compareSets(live as any, dev as any)
    const missing = files.filter(file => file.missing)
    const notMissing = files.filter(file => !file.missing)
    const changed = notMissing.filter(file => file.changed)

    const rows = changed.map(file => (
        <tr>
            <td>
                <a href={file.liveSvgUrl}>
                    <img src={file.liveSvgUrl} />
                </a>
                <a href={file.liveInteractiveUrl}>{file.liveInteractiveUrl}</a>
            </td>
            <td>
                <a href={file.devSvgPath}>
                    <img src={file.devSvgPath} />
                </a>
                <a href={file.devInteractiveUrl}>{file.devInteractiveUrl}</a>
            </td>
        </tr>
    ))

    const summaryMessage = `${changed.length} (${Math.round(
        (100 * changed.length) / notMissing.length
    )}%) out of ${notMissing.length} are different. ${notMissing.length -
        changed.length} unchanged. ${
        missing.length
    } files on live missing locally.`

    const missingDivs = missing.map(el => <div>${el.missing}</div>)

    return (
        <div>
            <div>{summaryMessage}</div>
            <table>{rows}</table>
            <div>{missing.length && <>{missingDivs}</>}</div>
        </div>
    )
}
