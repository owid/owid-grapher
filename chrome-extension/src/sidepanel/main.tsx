import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { App } from "./App.js"
// Import OWID site styles first, then our overrides
import "@owid/site/owid.scss"
import "@owid/packages/@ourworldindata/grapher/src/core/grapher.scss"
import "./styles.scss"

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>
)
