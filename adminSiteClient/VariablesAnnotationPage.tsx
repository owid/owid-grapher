import React from "react"
import { AdminLayout } from "./AdminLayout"
import { GrapherConfigGridEditor } from "./GrapherConfigGridEditor"
import { GrapherConfigGridEditorSource } from "./GrapherConfigGridEditorTypesAndUtils"

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
