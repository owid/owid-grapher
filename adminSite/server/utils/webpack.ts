import { WEBPACK_OUTPUT_PATH } from "serverSettings"
import { ENV, WEBPACK_DEV_URL } from "settings"
import * as fs from "fs-extra"
import * as path from "path"
import urljoin from "url-join"

export function getWebpackLinkForAsset(assetName: string) {
    if (ENV === "production") {
        const manifestPath = path.join(WEBPACK_OUTPUT_PATH, "manifest.json")
        const manifest = JSON.parse(
            fs.readFileSync(manifestPath).toString("utf8")
        )
        return urljoin("/admin/build/", manifest[assetName])
    } else {
        if (assetName.match(/\.js$/)) {
            assetName = `js/${assetName}`
        } else if (assetName.match(/\.css$/)) {
            assetName = `css/${assetName}`
        }

        return urljoin(WEBPACK_DEV_URL, assetName)
    }
}
