import { expect, it, describe } from "vitest"

import { createTagsForManifestEntry } from "./viteUtils.js"
import ReactDOMServer from "react-dom/server"

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

    // The site bundle's filenames carry a content hash, and nothing outside the
    // manifest knows what it is: pages have to pick the hashed filenames up from
    // the manifest entry, keyed by the (unhashed) entry point source path.
    it("uses the hashed filenames from the manifest", () => {
        const hashedManifest = {
            "site/owid.entry.css": {
                file: "assets/owid.DEg8Xc_1.css",
                src: "site/owid.entry.css",
            },
            "site/owid.entry.ts": {
                css: ["assets/owid.DEg8Xc_1.css"],
                file: "assets/owid.B7uK2p-9.mjs",
                isEntry: true,
                src: "site/owid.entry.ts",
            },
        }

        const assets = createTagsForManifestEntry(
            hashedManifest,
            "site/owid.entry.ts",
            "BASE/"
        )

        const render = (asset: (typeof assets.forHeader)[number]) =>
            ReactDOMServer.renderToStaticMarkup(asset)

        expect(assets.forHeader.map(render)).toEqual(
            expect.arrayContaining([
                '<link rel="preload" href="BASE/assets/owid.DEg8Xc_1.css" as="style"/>',
                '<link rel="stylesheet" href="BASE/assets/owid.DEg8Xc_1.css"/>',
                '<link rel="modulepreload" href="BASE/assets/owid.B7uK2p-9.mjs"/>',
            ])
        )
        expect(assets.forFooter.map(render)).toEqual([
            '<script type="module" src="BASE/assets/owid.B7uK2p-9.mjs" data-attach-owid-error-handler="true"></script>',
        ])
    })
})
