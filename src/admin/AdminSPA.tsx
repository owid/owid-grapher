import * as React from 'react'
import webpack from './webpack'

export default function AdminSPA(props: { rootUrl: string, username: string }) {
    const script = `
        window.Global = {}
        Global.rootUrl = "${props.rootUrl}"
        window.App = {}
        App.isEditor = true
        window.admin = new Admin(Global.rootUrl, ${props.username})
        admin.start(document.body)
    `
    return <html lang="en">
        <head>
            <title>owid-grapher</title>
            <meta name="description" content=""/>
            <link href={webpack("charts.css")} rel="stylesheet" type="text/css"/>
            <link href={webpack("editor.css")} rel="stylesheet" type="text/css"/>
        </head>
        <body>
            <script src={webpack("charts.js")}></script>
            <script src={webpack("editor.js")}></script>
            <script type="text/javascript" dangerouslySetInnerHTML={{__html: script}}/>
        </body>
    </html>
}