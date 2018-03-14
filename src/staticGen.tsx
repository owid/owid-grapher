import { BUILD_GRAPHER_URL } from './settings'

export function embedSnippet(basePath: string, chartsJs: string, chartsCss: string): string {
    return `
        window.App = {};
        window.Global = { rootUrl: '${BUILD_GRAPHER_URL}' };

        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = '${chartsCss}';
        document.head.appendChild(link);

        var hasPolyfill = false;
        var hasGrapher = false;

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasPolyfill = true;
            if (hasGrapher)
                window.Grapher.embedAll();
        }
        script.src = "https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch"
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasGrapher = true;
            if (hasPolyfill)
                window.Grapher.embedAll();
        }
        script.src = '${chartsJs}';
        document.head.appendChild(script);
    `
}