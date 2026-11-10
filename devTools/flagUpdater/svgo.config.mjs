export default {
    js2svg: { indent: 2, pretty: true },
    plugins: [
        "preset-default",
        "convertStyleToAttrs",
        "removeDimensions",
        "removeScripts",
        "removeStyleElement",
        "sortAttrs",
    ],
}
