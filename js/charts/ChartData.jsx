/* ChartData.jsx
 * ================                                                             
 *
 * Compiles the dimensions associated with a chart into something cohesive and queryable
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import ChartConfig from './ChartConfig'

export default class ChartData {
    constructor(chart: ChartConfig) {
        let data = []
        _.each(chart.dimensions, (dimension) => {
            const v = dimension.variable
            for (var i = 0; i < v.years.length; i++) {
                let d = { year: v.years[i], entity: v.entityKey[v.entities[i]] }
                d[dimension.property] = v.values[i]
                data.push(d)
            }
        })

        this.data = data
    }
}