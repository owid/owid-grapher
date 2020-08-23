#!/usr/bin/env ts-node

// todo: remove?

import * as fs from "fs-extra"

const bakeSandbox = async (outputPath: string) => {
    outputPath = outputPath.replace(/\/$/, "") + "/"
    console.log(
        `Baking sandbox to "${outputPath}". Be sure to run 'yarn build' first to build needed bundles.`
    )

    const webPackHost = `http://localhost:8090`

    const assets = `/css/commons.css
/css/owid.css
/js/owid.js
/js/commons.js`.split("\n")

    await fs.mkdirp(outputPath)
    let indexPage = fs.readFileSync(__dirname + "/index.html", "utf8")
    assets.forEach(url => {
        url = webPackHost + url
        const parts = url.split("/")
        const filename = parts[parts.length - 1]
        const extension = filename.split(".").pop()
        fs.copy(
            `${__dirname}/../../dist/webpack/${extension}/${filename}`,
            outputPath + filename
        )
        indexPage = indexPage.replace(url, filename)
    })
    fs.writeFileSync(outputPath + "index.html", indexPage, "utf8")
    fs.writeFileSync(
        outputPath + "chart.js",
        fs.readFileSync(__dirname + "/chart.js", "utf8"),
        "utf8"
    )
}

const destination = process.argv[2]
if (!destination) throw new Error("No destination folder provided")
bakeSandbox(destination)
