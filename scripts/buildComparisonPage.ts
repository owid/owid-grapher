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

    return { path, oldSvg, changed, newSvg, oldSvgPath, newSvgPath }
})

const changed = files.filter(file => !file.missing).filter(file => file.changed)

console.log(changed.length + " changed")

const table = changed
    .map(
        file =>
            `<tr><td><img src="${file.oldSvgPath}">${file.oldSvgPath}</td><td><img src="${file.newSvgPath}">${file.newSvgPath}</td></tr>`
    )
    .join("\n")

fs.writeFileSync(outputFile, `<table>${table}</table>`)
