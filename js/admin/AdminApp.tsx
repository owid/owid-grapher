import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'

export default class AdminApp extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props

        const m = admin.currentPath.match(/\/charts\/(\d+)\/edit/)
        const chartId = m && parseInt(m[1])

        return <div className="AdminApp">
            {chartId !== null && <ChartEditorPage admin={admin} chartId={chartId}/>}
        </div>
    }
}