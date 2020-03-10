import * as React from "react"
import * as _ from "lodash"

import { webpack } from "./webpack"
import * as settings from "settings"

export function AdminSPA(props: { username: string; isSuperuser: boolean }) {
    const script = `
        window.App = {}
        App.isEditor = true
        window.admin = new Admin({ username: "${
            props.username
        }", isSuperuser: ${props.isSuperuser.toString()}, settings: ${JSON.stringify(
        _.pick(settings, ["ENV", "GITHUB_USERNAME", "EXPLORER"])
    )}})
        admin.start(document.querySelector("#app"))
`

    return (
        <html lang="en">
            <head>
                <title>owid-admin</title>
                <meta name="description" content="" />
                <link
                    href={webpack("commons.css")}
                    rel="stylesheet"
                    type="text/css"
                />
                <link
                    href={webpack("admin.css")}
                    rel="stylesheet"
                    type="text/css"
                />
            </head>
            <body>
                <div id="app"></div>
                <script src={webpack("commons.js")}></script>
                <script src={webpack("admin.js")}></script>
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
