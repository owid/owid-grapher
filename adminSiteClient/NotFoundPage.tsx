import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import { AdminLayout } from "./AdminLayout.js"

@observer
export class NotFoundPage extends ObservedReactComponent {
    render() {
        return (
            <AdminLayout>
                <main className="NotFoundPage">
                    <h1>404 Not Found</h1>
                </main>
            </AdminLayout>
        )
    }
}
