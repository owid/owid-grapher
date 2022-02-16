import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GrapherConfigGridEditor } from "./GrapherConfigGridEditor.js"
import { GrapherConfigGridEditorSource } from "./GrapherConfigGridEditorTypesAndUtils.js"

export class BulkGrapherConfigEditorPage extends React.Component {
    render() {
        return (
            <AdminLayout title="Bulk chart editor">
                <main className="VariablesAnnotationPage">
                    <GrapherConfigGridEditor
                        source={GrapherConfigGridEditorSource.SourceCharts}
                    />
                </main>
            </AdminLayout>
        )
    }

    //dispose!: IReactionDisposer
}
