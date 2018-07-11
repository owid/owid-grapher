import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction} from 'mobx'
const fuzzysort = require("fuzzysort")
import * as _ from 'lodash'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { SearchField, FieldsRow, SelectField } from './Forms'
import Link from './Link'

@observer
export default class TestIndexPage extends React.Component {
    context!: { admin: Admin }

    render() {
        return <AdminLayout title="Test">
            <main className="TestIndexPage">
                <h2>Test Embeds</h2>
                <ul>
                    <li><Link native to="/test/embeds">All Charts</Link></li>
                    <li><Link native to="/test/embeds?type=ChoroplethMap">Choropleth Map</Link></li>
                    <li><Link native to="/test/embeds?type=LineChart">Line Chart</Link></li>
                    <li><Link native to="/test/embeds?type=DiscreteBar">Discrete Bar</Link></li>
                    <li><Link native to="/test/embeds?type=ScatterPlot">Scatter Plot</Link></li>
                    <li><Link native to="/test/embeds?type=StackedArea">Stacked Area</Link></li>
                    <li><Link native to="/test/embeds?type=StackedBar">Stacked Bar</Link></li>
                </ul>
            </main>
        </AdminLayout>
    }
}