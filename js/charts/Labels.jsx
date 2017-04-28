/* Labels.jsx
 * ================                                                             
 *
 * Non-overlapping labels in SVG
 * 
 * This API should be kept agnostic from the actual implementation details of
 * the labelling algorithm, so that it can be upgraded to something fancier later if needed.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-10
 */ 

// @flow

import React, {Component} from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import _ from 'lodash'
import Bounds from './Bounds'

export type LabelDatum = {
    x: number,
    y: number,
    label: string,
    fontSize: number
};

@observer
export default class Labels extends Component {
    props: {
        data: LabelDatum[],
        labelPriority: (LabelDatum, LabelDatum) => LabelDatum
    }

    @computed get labelData() : Object[] {
        const labelData = _.clone(this.props.data)
        const {labelPriority} = this.props

        _.each(labelData, d => {
            d.bounds = Bounds.forText(d.label, { fontSize: d.fontSize }).extend({
                x: d.x,
                y: d.y
            })            
        })

        // Eliminate overlapping labels,
        _.each(labelData, (d1) => {
            _.each(labelData, (d2) => {
                if (d1 !== d2 && !d1.hidden && !d2.hidden && d1.bounds.intersects(d2.bounds)) {
                    if (labelPriority(d1, d2) == d1)
                        d2.hidden = true
                    else
                        d1.hidden = true
                }               
            })
        })
        return _.filter(labelData, d => !d.hidden)
    }


    render() {
        const {labelData} = this

        return <g class="labels" {...this.props}>
            {_.map(labelData, d =>
                <text x={d.x} y={d.y} fontSize={d.fontSize}>{d.label}</text>
            )}
        </g>        
    }
}