import { uniqBy } from './Util'
import * as React from 'react'
import { observer } from 'mobx-react'
import { computed, action, observable } from 'mobx'
import ChartConfig from './ChartConfig'
import { DataKeyInfo } from './ChartData'
import ChartView from './ChartView'
import FuzzySearch from './FuzzySearch'

@observer
export class DataSelectorMulti extends React.Component<{ chart: ChartConfig, chartView: ChartView, onDismiss: () => void }> {
    @observable searchInput?: string
    searchField: HTMLInputElement
    base: HTMLDivElement

    @computed get availableData(): DataKeyInfo[] {
        const { chart } = this.props
        return chart.data.availableKeys.map(key => chart.data.lookupKey(key))
    }

    @computed get selectedData() {
        return this.availableData.filter(d => this.props.chart.data.selectedKeysByKey[d.key])
    }

    @computed get unselectedData() {
        return this.availableData.filter(d => !this.props.chart.data.selectedKeysByKey[d.key])
    }

    @computed get fuzzy(): FuzzySearch<DataKeyInfo> {
        return new FuzzySearch(this.unselectedData, 'label')
    }

    @computed get searchResults(): DataKeyInfo[] {
        return this.searchInput ? this.fuzzy.search(this.searchInput) : this.unselectedData
    }

    @action.bound onClickOutside(e: MouseEvent) {
        if (this.base && !this.base.contains(e.target as Node))
            this.props.onDismiss()
    }

    componentDidMount() {
        setTimeout(() => document.addEventListener("click", this.onClickOutside), 1)
        if (!this.props.chartView.isMobile)
            this.searchField.focus()
    }

    componentDidUnmount() {
        document.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.props.chart.data.toggleKey(this.searchResults[0].key)
            this.searchInput = ""
        } else if (e.key === "Escape")
            this.props.onDismiss()
    }

    render() {
        const { chart } = this.props
        const { selectedData, searchResults, searchInput } = this

        return <div className="DataSelectorMulti" onClick={e => e.stopPropagation()}>
            <h2>Choose data to show <button onClick={this.props.onDismiss}><i className="fa fa-times" /></button></h2>
            <div>
                <div className="searchResults">
                    <input type="search" placeholder="Search..." value={searchInput} onInput={e => this.searchInput = e.currentTarget.value} onKeyDown={this.onSearchKeyDown} ref={e => this.searchField = (e as HTMLInputElement)} />
                    <ul>
                        {searchResults.map(d => {
                            return <li>
                                <label className="clickable">
                                    <input type="checkbox" checked={false} onChange={() => chart.data.toggleKey(d.key)} /> {d.label}
                                </label>
                            </li>
                        })}
                    </ul>
                </div>
                <div className="selectedData">
                    <ul>
                        {selectedData.map(d => {
                            return <li>
                                <label className="clickable">
                                    <input type="checkbox" checked={true} onChange={() => chart.data.toggleKey(d.key)} /> {d.label}
                                </label>
                            </li>
                        })}
                    </ul>
                </div>
            </div>
        </div>
    }
}

@observer
export class DataSelectorSingle extends React.Component<{ chart: ChartConfig, chartView: ChartView, onDismiss: () => void }> {
    @observable searchInput?: string
    searchField: HTMLInputElement
    base: HTMLDivElement

    @computed get availableItems() {
        const availableItems: { id: number, label: string }[] = []
        this.props.chart.data.keyData.forEach(meta => {
            availableItems.push({
                id: meta.entityId,
                label: meta.entity
            })
        })
        return uniqBy(availableItems, d => d.label)
    }

    @computed get fuzzy(): FuzzySearch<{ id: number, label: string }> {
        return new FuzzySearch(this.availableItems, 'label')
    }

    @computed get searchResults(): { id: number, label: string }[] {
        return this.searchInput ? this.fuzzy.search(this.searchInput) : this.availableItems
    }

    @action.bound onClickOutside(e: MouseEvent) {
        if (this.base && !this.base.contains(e.target as Node))
            this.props.onDismiss()
    }

    componentDidMount() {
        setTimeout(() => document.addEventListener("click", this.onClickOutside), 1)
        if (!this.props.chartView.isMobile)
            this.searchField.focus()
    }

    componentDidUnmount() {
        document.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.onSelect(this.searchResults[0].id)
            this.searchInput = ""
        } else if (e.key === "Escape")
            this.props.onDismiss()
    }

    @action.bound onSelect(entityId: number) {
        this.props.chart.data.switchEntity(entityId)
        this.props.onDismiss()
    }

    render() {
        const { searchResults, searchInput } = this

        return <div className="DataSelectorSingle" onClick={e => e.stopPropagation()}>
            <input type="search" placeholder="Search..." value={searchInput} onInput={e => this.searchInput = e.currentTarget.value} onKeyDown={this.onSearchKeyDown} ref={e => this.searchField = (e as HTMLInputElement)} />
            <ul>
                {searchResults.map(d => {
                    return <li className="clickable" onClick={() => this.onSelect(d.id)}>
                        {d.label}
                    </li>
                })}
            </ul>
        </div>
    }
}

@observer
export default class DataSelector extends React.Component<{ chart: ChartConfig, chartView: ChartView, onDismiss: () => void }> {
    render() {
        const { chart } = this.props

        if (chart.data.canChangeEntity)
            return <DataSelectorSingle {...this.props} />
        else
            return <DataSelectorMulti {...this.props} />
    }
}
