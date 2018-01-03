import ChartEditor, {EditorDatabase} from './ChartEditor'
import Admin from './Admin'
import * as React from 'react'
import {includes, capitalize} from '../charts/Util'
import ChartConfig from '../charts/ChartConfig'
import {observer} from 'mobx-react'
import {observable, computed, runInAction, autorun, action, IReactionDisposer} from 'mobx'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import ChartView from '../charts/ChartView'
import Bounds from '../charts/Bounds'
import SaveButtons from './SaveButtons'
import { Modal, LoadingBlocker } from './Forms'

@observer
export default class ChartIndexPage extends React.Component<{ admin: Admin }> {
    render() {
        return "hi"
    }
}
