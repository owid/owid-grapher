#! /usr/bin/env yarn tsn

import express from "express"
import * as fs from "fs"
import * as mime from "mime-types"

const PORT = 4433
const app = express()

const staticFolder = __dirname + "/../../owid-static"

if (!fs.existsSync(staticFolder))
    throw new Error(`Owid Static not found at ${staticFolder}`)

const fixPaths = (html: string) =>
    html.replace(/https\:\/\/ourworldindata\.org\//g, "/")

app.get("*", async (req, res) => {
    const filepath = staticFolder + req.path
    if (req.path === "/") return res.redirect("/index.html")
    if (!fs.existsSync(filepath) || fs.statSync(filepath).isDirectory()) {
        if (fs.existsSync(filepath + ".html"))
            return res.redirect(req.path + ".html")
        return res.send("Not found")
    }

    const html = fs.readFileSync(filepath, "utf8")
    const rewritten = fixPaths(html)
    res.setHeader("Content-Type", mime.lookup(filepath) || "text/plain")
    return res.send(rewritten)
})

app.listen(PORT, () => {
    console.log(`Owid Wayback running on http://localhost:${PORT}/`)
})
