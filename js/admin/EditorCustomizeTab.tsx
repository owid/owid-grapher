import * as React from 'react'
import { computed, action } from 'mobx'
import { observer } from 'mobx-react'
import ChartEditor from './ChartEditor'
import ChartConfig from '../charts/ChartConfig'
import { AxisConfigProps } from '../charts/AxisConfig'
import { TextField, NumberField, SelectField, Toggle, FieldsRow } from './Forms'
import ColorSchemes from '../charts/ColorSchemes'

import { Grid } from 'semantic-ui-react'

@observer
class ColorSchemeSelector extends React.Component<{ chart: ChartConfig }> {
    @action.bound onValue(value: string) {
        this.props.chart.props.baseColorScheme = value === 'default' ? undefined : value
    }

    @action.bound onInvertColorScheme(value: boolean) {
        this.props.chart.props.invertColorScheme = value || undefined
    }

    render() {
        const { chart } = this.props

        const availableColorSchemes = Object.keys(ColorSchemes)
        const colorSchemeLabels = availableColorSchemes.map(scheme => ColorSchemes[scheme].name)

        return <FieldsRow>
            <SelectField label="Color scheme" value={chart.baseColorScheme || "default"} onValue={this.onValue} options={["default"].concat(availableColorSchemes)} optionLabels={["Default"].concat(colorSchemeLabels)} /><br />
            <Toggle label="Invert colors" value={!!chart.props.invertColorScheme} onValue={this.onInvertColorScheme} />
        </FieldsRow>
    }
}

@observer
export default class EditorCustomizeTab extends React.Component<{ editor: ChartEditor }> {
    @computed get xAxis() { return this.props.editor.chart.xAxis.props }
    @computed get yAxis() { return this.props.editor.chart.yAxis.props }

    renderForAxis(axisName: string, axis: AxisConfigProps) {
        return <div>
            <FieldsRow>
                <Grid.Column><NumberField label={`${axisName}-Axis Min`} value={axis.min} onValue={(value) => axis.min = value} /></Grid.Column>
                <Grid.Column><NumberField label={`${axisName}-Axis Max`} value={axis.max} onValue={(value) => axis.max = value} /></Grid.Column>
            </FieldsRow>
            <Toggle label={`Enable log/linear selector`} value={axis.canChangeScaleType || false} onValue={(value) => axis.canChangeScaleType = value || undefined} />
        </div>
    }

    render() {
        const { xAxis, yAxis } = this
        const { features } = this.props.editor
        const { chart } = this.props.editor

        return <div>
            <ColorSchemeSelector chart={chart} />
            {(features.customYAxis || features.customYAxis) && <section>
                {features.customYAxis && this.renderForAxis('Y', yAxis)}
                {features.customXAxis && this.renderForAxis('X', xAxis)}
            </section>}
            {(features.hideLegend || features.relativeModeToggle) && <section className="legend-section">
                <h2>Legend</h2>
                {features.hideLegend && <Toggle label={`Hide legend`} value={!!chart.hideLegend} onValue={(value) => chart.props.hideLegend = value || undefined} />}
                {features.relativeModeToggle && <Toggle label={`Hide relative toggle`} value={!!chart.props.hideRelativeToggle} onValue={value => chart.props.hideRelativeToggle = value || undefined} />}
                {features.entityType && <TextField label={`Entity name`} placeholder="country" value={chart.props.entityType} onValue={value => chart.props.entityType = value || undefined} />}
            </section>}
        </div>
    }
}
