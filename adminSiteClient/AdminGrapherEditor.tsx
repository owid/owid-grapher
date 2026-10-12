import * as React from "react"
import { Prompt } from "react-router-dom"
import { GrapherEditor, GrapherEditorProps } from "./GrapherEditor.js"
import {
    adminEditorEnvironment,
    adminIndicatorUrl,
} from "./adminEditorProviders.js"

/**
 * The editor as the admin's pages use it: pointed at this admin's servers,
 * with the tab in the URL and a warning before leaving with unsaved changes
 */
export function AdminGrapherEditor(
    props: Omit<GrapherEditorProps, "onDirtyChange">
): React.ReactElement {
    const [isModified, setIsModified] = React.useState(false)
    return (
        <>
            <Prompt
                when={isModified}
                message="Are you sure you want to leave? Unsaved changes will be lost."
            />
            <GrapherEditor
                environment={adminEditorEnvironment}
                indicatorUrl={adminIndicatorUrl}
                syncTabWithUrl
                {...props}
                onDirtyChange={setIsModified}
            />
        </>
    )
}
