export default {
    js2svg: { indent: 2, pretty: true },
    plugins: [
        {
            name: "preset-default",
            params: {
                overrides: {
                    cleanupIds: false,
                    convertTransform: false,
                },
            },
        },
        "convertStyleToAttrs",
        "removeDimensions",
        "removeScripts",
        "removeStyleElement",
        "sortAttrs",
    ],
}
