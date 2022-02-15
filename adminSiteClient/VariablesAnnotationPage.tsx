import React from "react"
import { AdminLayout } from "./AdminLayout"
import { GrapherConfigGridEditor } from "./GrapherConfigGridEditor"

export class VariablesAnnotationPage extends React.Component {
    render() {
        return (
            <AdminLayout title="Variables">
                <main className="VariablesAnnotationPage">
                    <GrapherConfigGridEditor />
                </main>
            </AdminLayout>
        )
    }

    //dispose!: IReactionDisposer
}
