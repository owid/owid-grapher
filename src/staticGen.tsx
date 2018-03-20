import { BUILD_GRAPHER_URL } from './settings'

export function embedSnippet(basePath: string, commonsJs: string, commonsCss: string, chartsJs: string): string {
    return `
        window.App = {};
        window.Global = { rootUrl: '${BUILD_GRAPHER_URL}' };

        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = '${commonsCss}';
        document.head.appendChild(link);

        var hasPolyfill = false;
        var hasGrapher = false;

        var loadedScripts = 0;
        function checkReady() {
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
        script.src = '${commonsJs}';
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = checkReady;
        script.src = '${chartsJs}';
        document.head.appendChild(script);
    `
}