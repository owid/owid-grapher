#! /usr/bin/env yarn tsn

import express from "express"
import path from "path"
import * as fs from "fs-extra"
import * as mime from "mime-types"

const PORT = 4433
const app = express()

const staticFolder = __dirname + "/../../owid-static"

if (!fs.existsSync(staticFolder))
    throw new Error(`Owid Static not found at ${staticFolder}`)

const needsRewrite = (mimeType: string) =>
    // text/html, text/css, application/javascript or image/svg+xml
    mimeType.startsWith("text/") ||
    mimeType === "application/javascript" ||
    mimeType === "image/svg+xml"

const fixPaths = (fileContent: string) =>
    fileContent.replace(/https?\:\/\/ourworldindata\.org\//g, "/")

app.get("*", async (req, res) => {
    const filepath = path.resolve(staticFolder + req.path)
    if (req.path === "/") return res.redirect("/index.html")
    if (!fs.existsSync(filepath) || fs.statSync(filepath).isDirectory()) {
        if (fs.existsSync(filepath + ".html"))
            return res.redirect(req.path + ".html")
        return res.send("Not found")
    }

    const mimeType = mime.lookup(filepath) || "text/plain"

    if (needsRewrite(mimeType)) {
        const fileContent = await fs.readFile(filepath, "utf8")
        const rewritten = fixPaths(fileContent)
        res.setHeader("Content-Type", mimeType)
        return res.send(rewritten)
    } else res.sendFile(filepath)
})

app.listen(PORT, () => {
    console.log(`Owid Wayback running on http://localhost:${PORT}/`)
})
