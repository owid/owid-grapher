import React from "react"
import { AdminLayout } from "./AdminLayout"
import { GrapherConfigGridEditor } from "./GrapherConfigGridEditor"
import { GrapherConfigGridEditorSource } from "./GrapherConfigGridEditorTypesAndUtils"

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
