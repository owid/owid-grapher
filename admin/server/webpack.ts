import { ENV, ADMIN_ASSETS_URL, WEBPACK_OUTPUT_PATH } from 'settings'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as urljoin from 'url-join'

export function webpack(assetName: string) {
    if (ENV === 'production') {
        const manifestPath = path.join(WEBPACK_OUTPUT_PATH, 'manifest.json')
        const manifest = JSON.parse(fs.readFileSync(manifestPath).toString('utf8'))
        assetName = manifest[assetName.split('/')[1]]
    } else if (assetName.match(/\.js$/)) {
        assetName = `js/${assetName}`
    } else if (assetName.match(/\.css$/)) {
        assetName = `css/${assetName}`
    }

    return urljoin(ADMIN_ASSETS_URL, assetName)
}