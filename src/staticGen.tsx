import { ENV, BASE_DIR, BUILD_GRAPHER_URL, BUILD_ASSETS_URL } from './settings'
import * as fs from 'fs-extra'
import * as path from 'path'

let manifest: {[key: string]: string}
export function webpack(assetName: string) {
    if (ENV === 'production') {
        if (!manifest) {
            const manifestPath = path.join(BASE_DIR, 'grapher_admin/static/build/manifest.json')
            manifest = JSON.parse(fs.readFileSync(manifestPath).toString('utf8'))
        }

        return `${BUILD_ASSETS_URL}/${assetName}?v=${manifest[assetName]}`
    } else {
        return `${BUILD_ASSETS_URL}/${assetName}`
    }
}

export function embedSnippet(): string {
    return `
        window.App = {};
        window.Global = { rootUrl: '${BUILD_GRAPHER_URL}' };

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