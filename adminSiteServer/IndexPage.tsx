import * as React from "react"
import { getWebpackLinkForAsset } from "adminSiteServer/getWebpackLinkForAsset"
import { ENV, GITHUB_USERNAME } from "settings"

export const IndexPage = (props: {
    username: string
    isSuperuser: boolean
    gitCmsBranchName: string
}) => {
    const script = `
        window.isEditor = true
        window.admin = new Admin({ username: "${
            props.username
        }", isSuperuser: ${props.isSuperuser.toString()}, settings: ${JSON.stringify(
        { ENV, GITHUB_USERNAME }
    )}})
        admin.start(document.querySelector("#app"), '${props.gitCmsBranchName}')
`

    return (
        <html lang="en">
            <head>
                <title>owid-admin</title>
                <meta name="description" content="" />
                <link
                    href="https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i|Playfair+Display:400,700&display=swap"
                    rel="stylesheet"
                />
                <link
                    href={getWebpackLinkForAsset("commons.css")}
                    rel="stylesheet"
                    type="text/css"
                />
                <link
                    href={getWebpackLinkForAsset("admin.css")}
                    rel="stylesheet"
                    type="text/css"
                />
            </head>
            <body>
                <div id="app"></div>
                <script src={getWebpackLinkForAsset("commons.js")}></script>
                <script src={getWebpackLinkForAsset("admin.js")}></script>
                <script
                    type="text/javascript"
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
