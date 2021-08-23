import * as fs from "fs-extra" // todo: this should not be here.
import urljoin from "url-join"
import * as path from "path"
import { ENV } from "../settings/serverSettings"
import { flatten } from "../clientUtils/Util"

const WEBPACK_DEV_URL = process.env.WEBPACK_DEV_URL ?? "http://localhost:8090"
const WEBPACK_OUTPUT_PATH =
    process.env.WEBPACK_OUTPUT_PATH ?? path.join(__dirname + "/../", "webpack")

let manifest: { [key: string]: string }
export const webpackUrls = (
    assetNameAndExtension: string,
    baseUrl = "",
    isProduction = ENV === "production"
): string[] => {
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
        const extensionIndex = assetNameAndExtension.lastIndexOf(".")
        const [assetName, assetExtension] = [
            assetNameAndExtension.substring(0, extensionIndex),
            assetNameAndExtension.substring(extensionIndex + 1),
        ]
        return Object.entries(manifest)
            .filter(
                ([chunkName]) =>
                    chunkName.startsWith(`${assetName}`) &&
                    chunkName.endsWith(`.${assetExtension}`)
            )
            .map(([_, chunkName]) =>
                urljoin(baseUrl ? baseUrl : "", "/assets", chunkName)
            )
    }

    // Since we don't limit chunk size in development, there should be
    // a single chunk per asset, with a matching name.
    return [urljoin(WEBPACK_DEV_URL, assetNameAndExtension)]
}

export const bakeEmbedSnippet = (baseUrl: string) => {
    const jsScriptFiles: string[] = [
        "https://polyfill.io/v3/polyfill.min.js?features=es6,fetch,URL,IntersectionObserver,IntersectionObserverEntry",
        ...flatten(
            ["commons-js.js", "owid.js"].map((assetName) =>
                webpackUrls(assetName, baseUrl)
            )
        ),
    ]

    return `const embedSnippet = () => {

const coreStylesheets = [
    ${webpackUrls("commons-css.css", baseUrl)
        .map((href) => `'${href}'`)
        .join(",\n")}
]


coreStylesheets.forEach(url => {
    const link = document.createElement('link')
    link.type = 'text/css'
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
})

let loadedScripts = 0;
const checkReady = () => {
    loadedScripts++
    if (loadedScripts === ${jsScriptFiles.length})
        window.MultiEmbedderSingleton.embedAll()
}

const coreScripts = [
    ${jsScriptFiles.map((href) => `'${href}'`).join(",\n")}
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
}
