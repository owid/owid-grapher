import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GrapherConfigGridEditor } from "./GrapherConfigGridEditor.js"
import { GrapherConfigGridEditorSource } from "./GrapherConfigGridEditorTypesAndUtils.js"

export class VariablesAnnotationPage extends React.Component {
    render() {
        return (
            <AdminLayout title="Variables">
                <main className="VariablesAnnotationPage">
                    <GrapherConfigGridEditor
                        source={
                            GrapherConfigGridEditorSource.SourceVariableAnnotation
                        }
                    />
                </main>
            </AdminLayout>
        )
    }

    //dispose!: IReactionDisposer
}
