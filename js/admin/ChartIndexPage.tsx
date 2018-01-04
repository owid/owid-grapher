import Admin from './Admin'
import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action} from 'mobx'
import { Modal, LoadingBlocker } from './Forms'
import Link from './Link'
import AdminSidebar from './AdminSidebar'

interface ChartMeta {
    id: number
    slug: string
    title: string
    isPublished: boolean
    isStarred: boolean
    internalNotes: string
    type: string
    lastEditedAt: string
    lastEditedBy: string
    variables: { id: number, name: string }[]
}

@observer
class ChartRow extends React.Component<{ chart: ChartMeta }> {
    context: { admin: Admin }

    render() {
        const {chart} = this.props
        const {admin} = this.context

        return <tr>
            <td>
                <a className="star-toggle" title="Show this chart on the front page of the website.">
                    {chart.isStarred ? <i className="fa fa-star"/> : <i className="fa fa-star-o"/>}
                </a>
            </td>
            {chart.isPublished ? <td>
                <a href={`${admin.grapherRoot}/${chart.slug}`}>{chart.title}</a>
            </td> : <td>
                <span style={{ color: 'red' }}>Draft: </span> {chart.title}
            </td>}
            <td style={{"min-width": "120px"}}>{chart.type}</td>
            <td>{chart.variables.map(v => [
                <Link to={`/variables/${v.id}`} native/>,
                <br/>
            ])}</td>
            <td>{chart.internalNotes}</td>
            <td>{chart.lastEditedAt} by {chart.lastEditedBy}</td>
            <td>
                <Link to={`/charts/${chart.id}/edit`} className="btn btn-primary">Edit</Link>
            </td>
            <td>
                <button className="btn btn-danger">Delete</button>
            </td>
        </tr>
    }
}

@observer
export default class ChartIndexPage extends React.Component {
    context: { admin: Admin }

    @observable.ref charts: ChartMeta[] = []

    async getData() {
        const data = await this.context.admin.getJSON("/charts.json")
        this.charts = data.charts
    }

    componentDidMount() {
        this.getData()
    }

    render() {
        const {charts} = this

        return <main>
            <AdminSidebar/>
            <div>
                <table className="table">
                    <thead>
                        <tr>
                            <th><i className="fa fa-star"/></th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Variables</th>
                            <th>Notes</th>
                            <th>Last Updated</th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {charts.map(chart => <ChartRow chart={chart}/>)}
                    </tbody>
                </table>
            </div>
        </main>
    }
}
