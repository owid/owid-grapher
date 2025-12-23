import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.js"
// Import OWID site styles first, then our overrides
import "@owid/site/owid.scss"
import "@owid/packages/@ourworldindata/grapher/src/core/grapher.scss"
import "./styles.scss"

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
