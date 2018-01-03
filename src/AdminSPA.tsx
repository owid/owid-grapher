import {BASE_URL, STATIC_ROOT} from './settings'
import * as React from 'react'

// The single page app for the grapher admin
// This should end up being the only part of the grapher admin html that is rendered on the server
export default function AdminSPA(props: { currentUser: string }) {
    const script = `window.Global = {}
        Global.rootUrl = "${BASE_URL}"
        window.App = {}
        App.isEditor = true
        window.admin = new Admin("${BASE_URL}", "foo", "${props.currentUser}")
        admin.start(document.body)`

    return <html lang="en">
        <head>
            <title>owid-grapher</title>
            <link href={`${STATIC_ROOT}/charts.css`} rel="stylesheet" type="text/css"/>
            <link href={`${STATIC_ROOT}/editor.css`} rel="stylesheet" type="text/css"/>
        </head>
        <body>
            <script src={`${STATIC_ROOT}/charts.js`}></script>
            <script src={`${STATIC_ROOT}/editor.js`}></script>
            <script type="text/javascript" dangerouslySetInnerHTML={{__html: script}}></script>
        </body>
    </html>
}
