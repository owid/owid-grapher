#!/usr/bin/env ts-node

import * as fs from "fs-extra"
import * as http from "http"

const bakeSandbox = async (outputPath: string) => {
    console.log(`Baking sandbox to ${outputPath}`)

    const assets = `http://localhost:8090/css/commons.css
http://localhost:8090/css/owid.css
http://localhost:8090/js/owid.js
http://localhost:8090/js/commons.js`.split("\n")

    await fs.mkdirp(outputPath)
    let indexPage = fs.readFileSync(__dirname + "/index.html", "utf8")
    assets.forEach(url => {
        const parts = url.split("/")
        const filename = parts[parts.length - 1]
        indexPage = indexPage.replace(url, filename)
        const stream = fs.createWriteStream(outputPath + filename)
        http.get(url, response => response.pipe(stream))
    })
    fs.writeFileSync(outputPath + "index.html", indexPage, "utf8")
    fs.writeFileSync(
        outputPath + "chart.js",
        fs.readFileSync(__dirname + "/chart.js", "utf8"),
        "utf8"
    )
}

bakeSandbox(process.argv[2])
