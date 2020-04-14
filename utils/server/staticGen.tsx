import { WEBPACK_OUTPUT_PATH } from "serverSettings"
import { ENV, WEBPACK_DEV_URL, BAKED_BASE_URL } from "settings"
import * as fs from "fs-extra"
import urljoin from "url-join"
import * as path from "path"

let manifest: { [key: string]: string }
export function webpack(assetName: string, context?: string) {
    if (ENV === "production") {
        // Read the real asset name from the manifest in case it has a hashed filename
        if (!manifest) {
            const manifestPath = path.join(WEBPACK_OUTPUT_PATH, "manifest.json")
            manifest = JSON.parse(
                fs.readFileSync(manifestPath).toString("utf8")
            )
        }
        assetName = manifest[assetName]

        return urljoin(BAKED_BASE_URL, "/assets", assetName)
    } else {
        if (assetName.match(/\.js$/)) {
            assetName = `js/${assetName}`
        } else if (assetName.match(/\.css$/)) {
            assetName = `css/${assetName}`
        }

        return urljoin(WEBPACK_DEV_URL, assetName)
    }
}
