import * as React from 'react'
import {observer} from 'mobx-react'
import {computed, action, observable} from 'mobx'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import {DataKeyInfo} from './ChartData'
const Fuse = require("fuse.js")
const styles = require("./DataSelector.css")
import * as d3 from 'd3'
import ChartView from './ChartView'

@observer
export default class DataSelector extends React.Component<{ chart: ChartConfig, chartView: ChartView, onDismiss: () => void }> {
    @observable searchInput?: string
    @observable.ref previouslySelectedData: DataKeyInfo[]
    @observable.ref previouslyUnselectedData: DataKeyInfo[]
    searchField: HTMLInputElement

    @computed get availableData(): DataKeyInfo[] {
        const {chart} = this.props
        return chart.data.availableKeys.map(key => chart.data.lookupKey(key))
    }
    
    @computed get fuseSearch(): any {
        return new Fuse(this.previouslyUnselectedData, {
            shouldSort: true,
            threshold: 0.6,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: ["label"]
        });
    }

    @computed get searchResults(): DataKeyInfo[] {
        return this.searchInput ? this.fuseSearch.search(this.searchInput) : this.previouslyUnselectedData
    }

    componentWillMount() {
        this.previouslySelectedData = this.availableData.filter(d => this.props.chart.data.selectedKeysByKey[d.key])
        this.previouslyUnselectedData = this.availableData.filter(d => !this.props.chart.data.selectedKeysByKey[d.key])
    }

    componentDidMount() {
        //d3.select("html").on("click.DataSelector", this.props.onDismiss)
        if (!this.props.chartView.isMobile)
            this.searchField.focus()

    }

    componentDidUnmount() {
        d3.select("html").on("click.DataSelector", null)
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key == "Enter" && this.searchResults.length > 0)
            this.props.chart.data.toggleKey(this.searchResults[0].key)
        else if (e.key == "Escape")
            this.props.onDismiss()
    }

    render() {
        const {chart} = this.props
        const {previouslySelectedData, searchResults} = this

        return <div className={styles.DataSelector} onClick={e => e.stopPropagation()}>
            <h2>Choose data to show <button onClick={this.props.onDismiss}><i className="fa fa-times"/></button></h2>
            
            <ul>
                {previouslySelectedData.map(d => {
                    return <li>
                        <label className="clickable">
                            <input type="checkbox" checked={!!chart.data.selectedKeysByKey[d.key]} onChange={e => chart.data.toggleKey(d.key)}/> {d.label}
                        </label>
                    </li>
                })}
            </ul>
            <input type="search" placeholder="Search..." onInput={e => this.searchInput = e.currentTarget.value} onKeyDown={this.onSearchKeyDown} ref={e => this.searchField = (e as HTMLInputElement)}/>
            <ul>
                {searchResults.map(d => {
                    return <li>
                        <label className="clickable">
                            <input type="checkbox" checked={!!chart.data.selectedKeysByKey[d.key]} onChange={e => chart.data.toggleKey(d.key)}/> {d.label}
                        </label>
                    </li>
                })}
            </ul>
        </div>
    }
}