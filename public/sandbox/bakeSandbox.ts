#!/usr/bin/env ts-node

import * as fs from "fs-extra"

const bakeSandbox = async (outputPath: string) => {
    outputPath = outputPath.replace(/\/$/, "") + "/"
    console.log(
        `Baking sandbox to "${outputPath}". Be sure to run 'yarn build' first to build needed bundles.`
    )

    const assets = `http://localhost:8090/css/commons.css
http://localhost:8090/css/owid.css
http://localhost:8090/js/owid.js
http://localhost:8090/js/commons.js`.split("\n")

    await fs.mkdirp(outputPath)
    let indexPage = fs.readFileSync(__dirname + "/index.html", "utf8")
    assets.forEach(url => {
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
