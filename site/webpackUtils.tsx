import { ENV, BAKED_BASE_URL } from "settings"
import * as fs from "fs-extra"
import urljoin from "url-join"
import * as path from "path"

const WEBPACK_DEV_URL = process.env.WEBPACK_DEV_URL ?? "http://localhost:8090"
const WEBPACK_OUTPUT_PATH =
    process.env.WEBPACK_OUTPUT_PATH ??
    path.join(__dirname + "/../", "dist/webpack")

let manifest: { [key: string]: string }
export const webpackUrl = (assetName: string) => {
    if (ENV === "production") {
        // Read the real asset name from the manifest in case it has a hashed filename
        if (!manifest)
            manifest = JSON.parse(
                fs
                    .readFileSync(
                        path.join(WEBPACK_OUTPUT_PATH, "manifest.json")
                    )
                    .toString("utf8")
            )
        return urljoin(BAKED_BASE_URL, "/assets", manifest[assetName])
    }

    if (assetName.match(/\.js$/))
        return urljoin(WEBPACK_DEV_URL, `js/${assetName}`)

    if (assetName.match(/\.css$/))
        return urljoin(WEBPACK_DEV_URL, `css/${assetName}`)

    return urljoin(WEBPACK_DEV_URL, assetName)
}

export const bakeEmbedSnippet = () => `const embedSnippet = () => {
const link = document.createElement('link')
link.type = 'text/css'
link.rel = 'stylesheet'
link.href = '${webpackUrl("commons.css")}'
document.head.appendChild(link)

let loadedScripts = 0;
const checkReady = () => {
    loadedScripts++
    if (loadedScripts === 3)
        window.MultiEmbedderSingleton.embedAll()
}

const coreScripts = ['https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch', '${webpackUrl(
    "commons.js"
)}', '${webpackUrl("owid.js")}']

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
