import * as React from 'react'
import webpack from './webpack'

export default function AdminSPA(props: { username: string }) {
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
            <script type="text/javascript">
                window.Global = {}
                Global.rootUrl = "{% rootrequest %}"
                window.App = {}
                App.isEditor = true
                window.admin = new Admin("{% rootrequest %}", "{{ cachetag }}", "{{ current_user }}")
                admin.start(document.body)
            </script>
        </body>
    </html>
}