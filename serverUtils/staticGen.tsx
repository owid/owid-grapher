import { WEBPACK_OUTPUT_PATH } from "../adminSiteServer/utils/node_modules/serverSettings"
import { ENV, WEBPACK_DEV_URL, BAKED_BASE_URL } from "settings"
import * as fs from "fs-extra"
import urljoin from "url-join"
import * as path from "path"

let manifest: { [key: string]: string }
export const getWebpackUrlForAsset = (assetName: string) => {
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
