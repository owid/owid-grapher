import { ENV, BAKED_GRAPHER_URL, BAKED_ASSETS_URL, WEBPACK_OUTPUT_PATH } from 'settings'
import * as fs from 'fs-extra'
import * as urljoin from 'url-join'
import * as path from 'path'

let manifest: {[key: string]: string}
export function webpack(assetName: string) {
    if (ENV === 'production') {
        // Read the real asset name from the manifest in case it has a hashed filename
        if (!manifest) {
            const manifestPath = path.join(WEBPACK_OUTPUT_PATH, 'manifest.json')
            manifest = JSON.parse(fs.readFileSync(manifestPath).toString('utf8'))
        }
        assetName = manifest[assetName]
    } else if (assetName.match(/\.js$/)) {
        assetName = `js/${assetName}`
    } else if (assetName.match(/\.css$/)) {
        assetName = `css/${assetName}`
    }

    return urljoin(BAKED_ASSETS_URL, assetName)
}

export function embedSnippet(): string {
    return `
        window.App = {};
        window.Global = { rootUrl: '${BAKED_GRAPHER_URL}' };

        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = '${webpack('commons.css')}';
        document.head.appendChild(link);

        var hasPolyfill = false;
        var hasGrapher = false;

        var loadedScripts = 0;
        function checkReady() {
            loadedScripts += 1;
            if (loadedScripts == 3) {
                window.Grapher.embedAll();
            }
        }

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = checkReady;
        script.src = "https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch"
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = checkReady;
        script.src = '${webpack('commons.js')}';
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = checkReady;
        script.src = '${webpack('charts.js')}';
        document.head.appendChild(script);
    `
}