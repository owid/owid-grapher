/* ScatterData.ts
 * ================                                                             
 *
 * Compiles the dimensions associated with a chart into something cohesive and queryable
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import {computed, observable} from 'mobx'

// [1990, 1, null]
// [1992, null, 2] ^
// [1995, 3, null]

export default class ScatterData {
    constructor(chart: ChartConfig) { 
        this.chart = chart       
        const dataByYearAndEntity = {}

        // Which years do we need?
        // We choose as the "anchor variable" whichever has the lowest tolerance
/*        const axisDimensions = _.filter(chart.dimensions, d => d.property == 'x' || d.property == 'y')
        const anchorDim = _.sortBy(axisDimensions, d => d.tolerance)[0]
        const years = _.uniq(anchorDim.variable.years)
        const hasYear = _.keyBy(years)*/

       /* _.each(chart.dimensions.slice(0, 2), (dimension, i) => {
            const v = dimension.variable
            for (var i = 0; i < v.years.length; i++) {
                const year = v.years[i]
                const entity = v.entityKey[v.entities[i]].name
                const value = v.values[i]
                const key = entity + ' - ' + year
                let d = dataByYearAndEntity[key]
                if (d == null) {
                    d = { year: year, entity: entity }
                    dataByYearAndEntity[key] = d
                }
                d[dimension.property] = value
            }
        })

        this.rows = _.values(dataByYearAndEntity)*/
    }

    @computed get axisDimensions() {
        return _.filter(this.chart.dimensions, d => d.property == 'x' || d.property == 'y')
    }

    @computed get years() : number[] {
        // We use the axis variable with the lowest tolerance as the source of years to show        
        const anchorDim = _.sortBy(this.axisDimensions, d => d.tolerance)[0]
        const anchorYears = _.uniq(anchorDim.variable.years)
        const otherDim = _.find(this.axisDimensions, d => d !== anchorDim)

        // Compute tolerance years
        const otherYearIndex = {}
        _(otherDim.variable.years).uniq().each(year => {
            for (var i = year-otherDim.tolerance; i <= year+otherDim.tolerance; i++) {
                otherYearIndex[i] = true
            }
        })

        const otherYears = _.chain(otherYearIndex).keys().map(d => parseInt(d)).value()

        return _.intersection(anchorYears, otherDim.variable.years)
    }
}