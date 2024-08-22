import { createTagsForManifestEntry } from "./viteUtils.js"
import ReactDOMServer from "react-dom/server.js"

// This is our actual manifest.json file as of 2023-03-14
const manifest = {
    "_common.mjs": {
        css: ["assets/common.css"],
        file: "assets/common.mjs",
    },
    "adminSiteClient/admin.entry.css": {
        file: "assets/admin.css",
        src: "adminSiteClient/admin.entry.css",
    },
    "adminSiteClient/admin.entry.ts": {
        css: ["assets/admin.css"],
        file: "assets/admin.mjs",
        imports: ["_common.mjs"],
        isEntry: true,
        src: "adminSiteClient/admin.entry.ts",
    },
    "faBook.css": {
        file: "assets/common.css",
        src: "faBook.css",
    },
    "site/owid.entry.css": {
        file: "assets/owid.css",
        src: "site/owid.entry.css",
    },
    "site/owid.entry.ts": {
        css: ["assets/owid.css"],
        file: "assets/owid.mjs",
        imports: ["_common.mjs"],
        isEntry: true,
        src: "site/owid.entry.ts",
    },
}

describe(createTagsForManifestEntry, () => {
    it("creates imports from our manifest", () => {
        const assets = createTagsForManifestEntry(
            manifest,
            "site/owid.entry.ts",
            "BASE/"
        )

        const assetsForHeader = assets.forHeader.map((asset) =>
            ReactDOMServer.renderToStaticMarkup(asset)
        )
        const assetsForFooter = assets.forFooter.map((asset) =>
            ReactDOMServer.renderToStaticMarkup(asset)
        )

        expect(assetsForHeader.length).toEqual(6)

        // check equality disregarding order
        expect(assetsForHeader).toEqual(
            expect.arrayContaining([
                '<link rel="preload" href="BASE/assets/common.css" as="style"/>',
                '<link rel="preload" href="BASE/assets/owid.css" as="style"/>',
                '<link rel="stylesheet" href="BASE/assets/owid.css"/>',
                '<link rel="stylesheet" href="BASE/assets/common.css"/>',
                '<link rel="modulepreload" href="BASE/assets/owid.mjs"/>',
                '<link rel="modulepreload" href="BASE/assets/common.mjs"/>',
            ])
        )

        expect(assetsForFooter.length).toEqual(1)
        expect(assetsForFooter).toEqual([
            '<script type="module" src="BASE/assets/owid.mjs" data-attach-owid-error-handler="true"></script>',
        ])
    })
})
