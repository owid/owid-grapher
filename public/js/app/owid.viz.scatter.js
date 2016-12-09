;(function(d3) {
    "use strict";
    owid.namespace("owid.viz.scatter");

    owid.viz.scatter = function() {
        var viz = owid.dataflow();

        viz.inputs({
            chart: undefined,
            svg: undefined,
            data: {},
            bounds: undefined,
            axisConfig: undefined,
            dimensions: undefined,
            variables: undefined,
            inputYear: undefined,
            interpolation: null
        });

        viz.flow('dimensions : chart', function(chart) {
            return chart.model.getDimensions();
        });

        viz.flow('variables : chart', function(chart) {
            return chart.vardata.get('variables');
        });

        viz.flow('availableYears : dimensions, variables', function(dimensions, variables) {
            var yearSets = [];

            _.each(dimensions, function(dimension) {
                if (dimension.property != 'x' && dimension.property != 'y') return;
                yearSets.push(variables[dimension.variableId].years);
            });

            return _.intersection.apply(_, yearSets);
        });

        viz.flow('dataForAllYears : availableYears, dimensions, variables', function(availableYears, dimensions, variables) {
            var dataByYear = {};

            _.each(availableYears, function(year) {
                var data = [];
                data.entityIdToIndex = {};
                dataByYear[year] = data;
            });

            _.each(dimensions, function(dimension) {
                var variable = variables[dimension.variableId],
                    tolerance = parseInt(dimension.tolerance);

                for (var i = 0; i < variable.years.length; i++) {
                    var year = variable.years[i],
                        value = variable.values[i],
                        entity = variable.entityKey[variable.entities[i]];

                    _.each(availableYears, function(targetYear) {
                        // Skip years that aren't within tolerance of the target
                        if (year < targetYear-tolerance || year > targetYear+tolerance)
                            return;

                        var data = dataByYear[targetYear],
                            index = data.entityIdToIndex[entity.id],
                            datum = data[index];

                        if (!datum) {
                            index = data.length;
                            data.entityIdToIndex[entity.id] = index;
                            datum = { 
                                id: entity.id,
                                label: entity.name,
                                key: entity.name,
                                values: [{ time: {} }]
                            };
                            data.push(datum);
                        }

                        var d = datum.values[0];
                        d.time[dimension.property] = year;
                        d[dimension.property] = value;
                    });
                }                
            });

            _.each(dataByYear, function(v, k) {
                var index = dataByYear[k].entityIdToIndex;
                dataByYear[k] = _.filter(v, function(d) {
                    return _.has(d.values[0], 'x') && _.has(d.values[0], 'y');
                });
                dataByYear[k].entityIdToIndex = index;
            });

            return dataByYear;
        });

        var _timeline = owid.view.timeline();

        // hack
//        _timeline.flow('targetYear', function(targetYear) {
//            chart.model.set('chart-time', [targetYear, targetYear]);
//        });

        viz.flow('timeline : chart', function(chart) {
            return _timeline;
        });

        viz.flow('timeline, chart, bounds, availableYears, inputYear', function(timeline, chart, bounds, availableYears, inputYear) {
            var timelineHeight = 50;
            timeline.update({
                containerNode: chart.html,
                bounds: { top: bounds.top+bounds.height-timelineHeight, left: bounds.left, width: bounds.width, height: timelineHeight },
                years: availableYears,
                inputYear: inputYear
            });

            if (!timeline.bound) {
                timeline.flow('prevYear, nextYear, progress', function(prevYear, nextYear, progress) {
                    viz.update({ interpolation: { prevYear: prevYear, nextYear: nextYear, progress: progress }});
                });             
                timeline.bound = true;   
            }
        });

        viz.flow('currentData : dataForAllYears, inputYear, interpolation', function(dataForAllYears, inputYear, interpolation) {
            if (!interpolation)
                return dataForAllYears[inputYear];
            else {
                var prevData = dataForAllYears[interpolation.prevYear],
                    nextData = dataForAllYears[interpolation.nextYear],
                    progress = interpolation.progress;

                var newData = [];
                _.each(prevData, function(series) {
                    var nextSeries = nextData[nextData.entityIdToIndex[series.id]];
                    if (!nextSeries) return;

                    var prev = series.values[0],
                        next = nextSeries.values[0];

                    newData.push(_.extend({}, series, {
                        values: [{
                            x: prev.x + (next.x-prev.x)*progress,
                            y: prev.y + (next.y-prev.y)*progress,
                            time: next.time
                        }]
                    }));
                });

                return newData;
            }
        });

        var _scatter = owid.view.scatter();
        viz.flow('scatter : chart', function(chart) {
            return _scatter;
        });

        viz.flow('scatter, svg, currentData, bounds, axisConfig, timeline', function(scatter, svg, currentData, bounds, axisConfig, timeline) {
            scatter.update({
                svg: svg,
                data: currentData,
                bounds: _.extend({}, bounds, { height: bounds.height-timeline.bounds.height-10 }),
                axisConfig: axisConfig
            });
        });

//            if (!timeline.isPlaying)
  //              changes.inputYear = chartTime[0];            
        return viz;
    };
})(d3v4);