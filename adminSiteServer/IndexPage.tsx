import React from "react"
import {
    ENV,
    GITHUB_USERNAME,
    DATA_API_FOR_ADMIN_UI,
} from "../settings/serverSettings.js"
import { viteAssetsForAdmin } from "../site/viteUtils.js"

export const IndexPage = (props: {
    username: string
    isSuperuser: boolean
    gitCmsBranchName: string
}) => {
    const assets = viteAssetsForAdmin()
    const script = `
        window.isEditor = true
        window.admin = new Admin({ username: "${
            props.username
        }", isSuperuser: ${props.isSuperuser.toString()}, settings: ${JSON.stringify(
            { ENV, GITHUB_USERNAME, DATA_API_FOR_ADMIN_UI }
        )}})
        admin.start(document.querySelector("#app"), '${props.gitCmsBranchName}')
`

    return (
        <html lang="en">
            <head>
                <title>owid-admin</title>
                <meta name="description" content="" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                {assets.forHeader}
            </head>
            <body>
                <div id="app"></div>
                {assets.forFooter}
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
