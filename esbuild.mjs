#!/usr/bin/env node

import { sassPlugin } from "esbuild-sass-plugin"
import envPlugin from "esbuild-envfile-plugin"
import esbuild from "esbuild"

esbuild
    .build({
        logLevel: "info",
        entryPoints: ["site/owid.entry.ts"],
        bundle: true,
        outfile: "itsJustJavascript/esbuild/owid.js",
        sourcemap: true,
        plugins: [sassPlugin(), envPlugin],
        // minify: true,
    })
    .catch(() => process.exit(1))
