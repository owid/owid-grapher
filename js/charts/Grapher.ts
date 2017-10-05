import ChartView from './ChartView'

// Global variable entry point for initializing charts
export default class Grapher {
    // Look for all <figure data-grapher-src="..."> elements in the document and turn them
    // into iframeless embeds
    static embedAll() {
        const figures = Array.from(document.getElementsByTagName("figure"))
        figures.forEach(figure => {
            const dataSrc = figure.getAttribute('data-grapher-src')
            if (dataSrc) {
                fetch(dataSrc + ".config.json").then(data => data.json()).then(jsonConfig => {
                    ChartView.bootstrap({ jsonConfig, containerNode: figure })
                })
            }
        })
    }
}