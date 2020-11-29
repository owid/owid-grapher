import { WEBPACK_OUTPUT_PATH } from "serverSettings"
import { ENV, WEBPACK_DEV_URL } from "settings"
import * as fs from "fs-extra"
import * as path from "path"
import urljoin from "url-join"

export const getWebpackLinkForAsset = (assetName: string) => {
    if (ENV === "production")
        return urljoin(
            "/admin/build/",
            JSON.parse(
                fs
                    .readFileSync(
                        path.join(WEBPACK_OUTPUT_PATH, "manifest.json")
                    )
                    .toString("utf8")
            )[assetName]
        )

    if (assetName.match(/\.js$/))
        return urljoin(WEBPACK_DEV_URL, `js/${assetName}`)
    else if (assetName.match(/\.css$/))
        return urljoin(WEBPACK_DEV_URL, `css/${assetName}`)

    return urljoin(WEBPACK_DEV_URL, assetName)
}
