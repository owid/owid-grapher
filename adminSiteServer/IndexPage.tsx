import React from "react"
import {
    ENV,
    GITHUB_USERNAME,
    DATA_API_FOR_ADMIN_UI,
} from "../settings/serverSettings.js"
import { viteAssets } from "../site/viteUtils.js"
import { webpackUrl } from "../site/webpackUtils.js"

export const IndexPage = (props: {
    username: string
    isSuperuser: boolean
    gitCmsBranchName: string
}) => {
    const adminStylesheetUrls = [
        "https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i,900|Playfair+Display:400,600,700&display=swap",
        webpackUrl("admin.css", "/admin"),
        webpackUrl("commons.css", "/admin"),
    ]

    const script = `
        window.isEditor = true
        window.admin = new Admin({ username: "${
            props.username
        }", isSuperuser: ${props.isSuperuser.toString()}, settings: ${JSON.stringify(
        { ENV, GITHUB_USERNAME, DATA_API_FOR_ADMIN_UI }
    )}})
        admin.start(document.querySelector("#app"), '${props.gitCmsBranchName}')
`
    const assets = viteAssets("adminSiteClient/admin.entry.ts")

    return (
        <html lang="en">
            <head>
                <title>owid-admin</title>
                <meta name="description" content="" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                {assets.styles}
            </head>
            <body>
                <div id="app"></div>
                {assets.scripts}
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: script }}
                />
                {/* This lets the public frontend know to show edit links and such */}
                <iframe
                    src="https://ourworldindata.org/identifyadmin"
                    style={{ display: "none" }}
                />
            </body>
        </html>
    )
}
