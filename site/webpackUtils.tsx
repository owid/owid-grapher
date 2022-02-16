import fs from "fs-extra" // todo: this should not be here.
import urljoin from "url-join"
import * as path from "path"
import { ENV } from "../settings/serverSettings.js"

import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const WEBPACK_DEV_URL = process.env.WEBPACK_DEV_URL ?? "http://localhost:8090"
const WEBPACK_OUTPUT_PATH =
    process.env.WEBPACK_OUTPUT_PATH ?? path.join(__dirname + "/../", "webpack")

let manifest: { [key: string]: string }
export const webpackUrl = (
    assetName: string,
    baseUrl = "",
    isProduction = ENV === "production"
) => {
    if (isProduction) {
        // Read the real asset name from the manifest in case it has a hashed filename
        if (!manifest)
            manifest = JSON.parse(
                fs
                    .readFileSync(
                        path.join(WEBPACK_OUTPUT_PATH, "manifest.json")
                    )
                    .toString("utf8")
            )
        if (baseUrl) return urljoin(baseUrl, "/assets", manifest[assetName])
        else return urljoin("/", "assets", manifest[assetName])
    }

    return urljoin(WEBPACK_DEV_URL, assetName)
}

export const bakeEmbedSnippet = (
    baseUrl: string
) => `const embedSnippet = () => {
const link = document.createElement('link')
link.type = 'text/css'
link.rel = 'stylesheet'
link.href = '${webpackUrl("commons.css", baseUrl)}'
document.head.appendChild(link)

let loadedScripts = 0;
const checkReady = () => {
    loadedScripts++
    if (loadedScripts === 4)
        window.MultiEmbedderSingleton.embedAll()
}

const coreScripts = [
    'https://polyfill.io/v3/polyfill.min.js?features=es6,fetch,URL,IntersectionObserver,IntersectionObserverEntry',
    '${webpackUrl("commons.js", baseUrl)}',
    '${webpackUrl("vendors.js", baseUrl)}',
    '${webpackUrl("owid.js", baseUrl)}'
]

coreScripts.forEach(url => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.onload = checkReady
    script.src = url
    document.head.appendChild(script)
})
}
embedSnippet()
`
