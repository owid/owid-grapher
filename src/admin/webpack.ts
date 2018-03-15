import * as settings from '../settings'
import * as fs from 'fs-extra'
import * as path from 'path'

let manifest: {[key: string]: string}
export default function webpack(assetName: string) {
    if (settings.ENV === 'production') {
        if (!manifest) {
            const manifestPath = path.join(settings.BASE_DIR, 'grapher_admin/static/build/manifest.json')
            manifest = JSON.parse(fs.readFileSync(manifestPath).toString('utf8'))
        }
        return `/grapher/admin/static/build/${manifest[assetName]}`
    } else {
        return `${settings.WEBPACK_DEV_URL}/${assetName}`
    }
}