#! /usr/bin/env yarn tsn

import * as fs from "fs-extra"

const outputFile = process.argv[2]
const oldFolder = process.argv[3].replace(/\/$/, "") + "/"
const newFolder = process.argv[4].replace(/\/$/, "") + "/"

const files = fs.readdirSync(oldFolder).map(path => {
    const oldSvgPath = oldFolder + path
    const newSvgPath = newFolder + path

    if (!fs.existsSync(oldSvgPath)) return { missing: oldSvgPath }

    if (!fs.existsSync(newSvgPath)) return { missing: newSvgPath }

    const oldSvg = fs.readFileSync(oldSvgPath, "utf8")
    const newSvg = fs.readFileSync(newSvgPath, "utf8")
    const changed = oldSvg !== newSvg
    const slug = oldSvgPath
        .split("/")
        .pop()!
        .split("_v")[0]
    const prodUrl = `http://ourworldindata.org/grapher/${slug}`
    const devUrl = `http://localhost:3099/grapher/${slug}`
    return {
        path,
        oldSvg,
        changed,
        newSvg,
        oldSvgPath,
        newSvgPath,
        devUrl,
        prodUrl
    }
})

const changed = files.filter(file => !file.missing).filter(file => file.changed)

console.log(
    `${changed.length} (${Math.round(
        (100 * changed.length) / files.length
    )}%) out of ${files.length} are different. ${files.length -
        changed.length} unchanged.`
)

const table = changed
    .map(
        file =>
            `<tr>
 <td>
            <a href="${file.oldSvgPath}"> <img src="${file.oldSvgPath}"> </a>
            <a href="${file.prodUrl}">${file.prodUrl}</a>
    </td>
    <td>
            <a href="${file.newSvgPath}"> <img src="${file.newSvgPath}"> </a>
            <a href="${file.devUrl}">${file.devUrl}</a>
    </td>
</tr>`
    )
    .join("\n")

fs.writeFileSync(outputFile, `<table>${table}</table>`)
