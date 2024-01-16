import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "./AdminLayout.js"

@observer
export class PostsWithChartCount extends React.Component {
    render() {
        return (
            <AdminLayout title="Posts with chart count">
                <main className="PostsIndexPage">
                    <div>Change me</div>
                </main>
            </AdminLayout>
        )
    }
}
