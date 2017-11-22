import * as React from 'react'
import { clone, map, debounce } from '../charts/Util'
import { computed, action, observable } from 'mobx'
import { observer } from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import DataKey from '../charts/DataKey'
import { NumberField, EditableList, EditableListItem, EditableListItemProps, ColorBox, SelectField } from './Forms'
import ChartEditor from './ChartEditor'
import { Form, Radio } from 'semantic-ui-react'

interface DataKeyItemProps extends EditableListItemProps {
    chart: ChartConfig
    datakey: DataKey
}

@observer
class DataKeyItem extends React.Component<DataKeyItemProps> {
    @observable.ref isChoosingColor: boolean = false

    @computed get color() { return this.props.chart.data.keyColors[this.props.datakey] }

    @action.bound onColor(color: string | undefined) {
        this.props.chart.data.setKeyColor(this.props.datakey, color)
    }

    @action.bound onRemove() {
        this.props.chart.data.selectedKeys = this.props.chart.data.selectedKeys.filter(e => e !== this.props.datakey)
    }

    render() {
        const { props, color } = this
        const { chart, datakey, ...rest } = props
        const meta = chart.data.keyData.get(datakey)

        return <EditableListItem className="DataKeyItem" key={datakey} {...rest}>
            <div>
                <div><i className="fa fa-arrows-v"/></div>
                <ColorBox color={color} onColor={this.onColor}/>
                {meta ? meta.fullLabel : datakey}
            </div>
            <div className="clickable" onClick={this.onRemove}><i className="fa fa-remove"/></div>
        </EditableListItem>
    }
}

@observer
class KeysSection extends React.Component<{ chart: ChartConfig }> {
    @observable.ref dragKey?: DataKey

    @action.bound onAddKey(key: string) {
        this.props.chart.data.selectKey(key)
    }

    @action.bound onStartDrag(key: DataKey) {
        this.dragKey = key

        const onDrag = action(() => {
            this.dragKey = undefined
            window.removeEventListener('mouseup', onDrag)
        })

        window.addEventListener('mouseup', onDrag)
    }

    @action.bound onMouseEnter(targetKey: DataKey) {
        if (!this.dragKey || targetKey === this.dragKey)
            return

        const selectedKeys = clone(this.props.chart.data.selectedKeys)
        const dragIndex = selectedKeys.indexOf(this.dragKey)
        const targetIndex = selectedKeys.indexOf(targetKey)
        selectedKeys.splice(dragIndex, 1)
        selectedKeys.splice(targetIndex, 0, this.dragKey)
        this.props.chart.data.selectedKeys = selectedKeys
    }

    render() {
        const { chart } = this.props
        const { selectedKeys, remainingKeys } = chart.data

        const keyLabels = remainingKeys.map(key => chart.data.lookupKey(key).fullLabel)

        return <section className="entities-section">
            <h2>Choose data to show</h2>
            <SelectField onValue={this.onAddKey} value="Select data" options={["Select data"].concat(remainingKeys)} optionLabels={["Select data"].concat(keyLabels)}/>
            <EditableList>
                {map(selectedKeys, datakey =>
                    <DataKeyItem chart={chart} datakey={datakey} onMouseDown={() => this.onStartDrag(datakey)} onMouseEnter={() => this.onMouseEnter(datakey)} />
                )}
            </EditableList>
        </section>
    }
}

@observer
class TimeSection extends React.Component<{ editor: ChartEditor }> {
    base: HTMLDivElement

    @computed get chart() { return this.props.editor.chart }

    @computed get isDynamicTime() {
        return this.chart.timeDomain[0] === undefined && this.chart.timeDomain[1] === undefined
    }

    @computed get minTime() { return this.chart.props.minTime }
    @computed get maxTime() { return this.chart.props.maxTime }
    @computed get minPossibleTime() {
        return this.chart.data.primaryVariable ? this.chart.data.primaryVariable.minYear : 1900
    }
    @computed get maxPossibleTime() {
        return this.chart.data.primaryVariable ? this.chart.data.primaryVariable.maxYear : 2015
    }

    @action.bound onToggleDynamicTime() {
        if (this.isDynamicTime) {
            this.chart.timeDomain = [this.minPossibleTime, this.maxPossibleTime]
        } else {
            this.chart.timeDomain = [undefined, undefined]
        }
    }

    @action.bound onMinTime(value: number | undefined) {
        this.chart.props.minTime = value
    }

    @action.bound onMaxTime(value: number | undefined) {
        this.chart.props.maxTime = value
    }

    render() {
        const { features } = this.props.editor
        const { chart } = this

        return <section className="time-section">
            {features.timeDomain && <NumberField label="Min year" value={chart.props.minTime} onValue={debounce(this.onMinTime)} />}
            <NumberField label={features.timeDomain ? "Max year" : "Target year"} value={chart.props.maxTime} onValue={debounce(this.onMaxTime)} />
        </section>
    }
}

@observer
export default class EditorDataTab extends React.Component<{ editor: ChartEditor }> {
    render() {
        const { editor } = this.props
        const { chart } = editor

        return <div className={"tab-pane"}>
            <section className="add-country-control-wrapper">
                <h4>Can user add/change data?</h4>
                <Form.Field>
                    <Radio label="User can add and remove data" name="add-country-mode" value="add-country" checked={chart.addCountryMode === "add-country"} onClick={_ => chart.props.addCountryMode = "add-country"}/>
                </Form.Field>
                <Form.Field>
                    <Radio label="User can change entity" name="add-country-mode" value="change-country" checked={chart.addCountryMode === "change-country"} onClick={_ => chart.props.addCountryMode = "change-country"} />
                </Form.Field>
                <Form.Field>
                    <Radio label="User cannot change/add data" name="add-country-mode" value="disabled" checked={chart.addCountryMode === "disabled"} onClick={_ => chart.props.addCountryMode = "disabled"} />
                </Form.Field>
            </section>
            {!editor.chart.isScatter && <TimeSection editor={editor} />}
            <KeysSection chart={editor.chart} />
        </div>
    }
}
