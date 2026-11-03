import * as React from "react"
import { Prompt } from "react-router-dom"
import { CATALOG_URL } from "../settings/clientSettings.mjs"
import { AdminAppContext } from "./AdminAppContext.js"
import { GrapherEditor, GrapherEditorProps } from "./GrapherEditor.js"
import {
    adminDetailsProvider,
    adminIndicatorStore,
    adminIndicatorUrl,
} from "./adminEditorProviders.js"

export function AdminGrapherEditor(
    props: Omit<
        GrapherEditorProps,
        | "store"
        | "details"
        | "catalogUrl"
        | "indicatorUrl"
        | "syncTabWithUrl"
        | "onModifiedChange"
    >
): React.ReactElement {
    const { admin } = React.useContext(AdminAppContext)
    const store = React.useMemo(() => adminIndicatorStore(admin), [admin])
    const details = React.useMemo(() => adminDetailsProvider(admin), [admin])
    const [isModified, setIsModified] = React.useState(false)
    return (
        <>
            <Prompt
                when={isModified}
                message="Are you sure you want to leave? Unsaved changes will be lost."
            />
            <GrapherEditor
                {...props}
                store={store}
                details={details}
                catalogUrl={CATALOG_URL}
                indicatorUrl={adminIndicatorUrl}
                syncTabWithUrl
                onModifiedChange={setIsModified}
            />
        </>
    )
}
