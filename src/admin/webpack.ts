import * as settings from '../settings'
import * as fs from 'fs-extra'
import * as path from 'path'

export function webpack(assetName: string) {
    if (settings.ENV === 'production') {
        const manifestPath = path.join(settings.BASE_DIR, 'dist/webpack/manifest.json')
        const manifest = JSON.parse(fs.readFileSync(manifestPath).toString('utf8'))
        return `/admin/build/${manifest[assetName]}`
    } else {
        return `${settings.WEBPACK_DEV_URL}/${assetName}`
    }
}