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
            colorScheme: [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
                "#00d5eb", // Africa
                "#aec7e8", // Antarctica
                "#ff5670", // Asia
                "#ffe900", // Europe
                "#00a71e", // North America
                "#9467bd", // Oceania
                "#7bed00", // South America
                "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]
        });

        // Calculate the years which have data, for the timeline
        viz.flow('availableYears : dimensions, variables', function(dimensions, variables) {
            var yearSets = [];

            _.each(dimensions, function(dimension) {
                if (dimension.property != 'x' && dimension.property != 'y') return;
                yearSets.push(variables[dimension.variableId].years);
            });

            return _.intersection.apply(_, yearSets);
        });

        // Calculate a default input year if none is given
        viz.flow('inputYear : inputYear, availableYears', function(inputYear, availableYears) {
            return _.isNumber(inputYear) ? inputYear : _.last(availableYears);
        });

        // Color scale for color dimension
        viz.flow('colorScale : colorScheme', function(colorScheme) {
            return d3.scaleOrdinal().range(colorScheme);
        });

        // Set domain for color scale now to get the right ordering
        viz.flow('colorScale, dimensions, variables', function(colorScale, dimensions, variables) {
            var colorDim = _.findWhere(dimensions, { property: 'color' });
            if (!colorDim) return;

            var variable = variables[colorDim.variableId];
            colorScale.domain(variable.categoricalValues);
            console.log(colorScale.domain());
        });

        // Precompute the data transformation for every year (so later animation is fast)
        viz.flow('dataByEntityAndYear : availableYears, dimensions, variables, colorScale', function(availableYears, dimensions, variables, colorScale) {
            var dataByEntityAndYear = {};

            // The data values
            _.each(dimensions, function(dimension) {
                if (dimension.property != 'x' && dimension.property != 'y') return;

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

                        var dataByYear = owid.default(dataByEntityAndYear, entity.id, {}),
                            series = owid.default(dataByYear, targetYear, {
                                id: entity.id,
                                label: entity.name,
                                key: entity.name,
                                values: [{ time: {} }]
                            });

                        var d = series.values[0];
                        d.time[dimension.property] = year;
                        d[dimension.property] = value;
                    }); 
                }                
            });

            // Colors
            _.each(dimensions, function(dimension) {
                if (dimension.property != 'color') return;

                var variable = variables[dimension.variableId];

                for (var i = 0; i < variable.entities.length; i++) {
                    var value = variable.values[i],
                        entityId = variable.entities[i];

                    _.each(dataByEntityAndYear[entityId], function(series) {
                        series.color = colorScale(value);
                    });
                }
            });

            // Exclude any with data for only one axis
            _.each(dataByEntityAndYear, function(v, k) {
                var newDataByYear = {};
                _.each(v, function(series, year) {
                    var datum = series.values[0];
                    if (_.has(datum, 'x') && _.has(datum, 'y'))
                        newDataByYear[year] = series;
                });
                dataByEntityAndYear[k] = newDataByYear;
            });

            return dataByEntityAndYear;
        });

        viz.flow('xDomain, yDomain : dataByEntityAndYear', function(dataByEntityAndYear) {
            var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

            _.each(dataByEntityAndYear, function(dataByYear) {
                _.each(dataByYear, function(series) {
                    var datum = series.values[0];
                    xMin = Math.min(datum.x, xMin);
                    xMax = Math.max(datum.x, xMax);
                    yMin = Math.min(datum.y, yMin);
                    yMax = Math.max(datum.y, yMax);
                });
            });

            return [[xMin, xMax], [yMin, yMax]];
        });

        var _timeline = owid.view.timeline();

        // hack
        _timeline.flow('targetYear', function(targetYear) {
            chart.model.set('chart-time', [targetYear, targetYear]);
        });

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
                timeline.flow('inputYear', function(inputYear) {
                    viz.update({ inputYear: inputYear });
                });
                timeline.bound = true;   
            }
        });

        viz.flow('isInterpolating : inputYear', function(inputYear) {
            return Math.round(inputYear) != inputYear;
        });

        viz.flow('currentData : dataByEntityAndYear, inputYear, timeline, isInterpolating', function(dataByEntityAndYear, inputYear, timeline, isInterpolating) {
            var currentData = [];

            _.each(dataByEntityAndYear, function(dataByYear, id) {
                if (!isInterpolating) {
                    if (dataByYear[timeline.targetYear])
                        currentData.push(dataByYear[timeline.targetYear]);
                    return;
                }

                var years = _.map(_.keys(dataByYear), function(d) { return parseInt(d); });

                var prevYear, nextYear;
                for (var i = 0; i < years.length; i++) {
                    prevYear = years[i];                    
                    nextYear = years[i+1];

                    if (nextYear > inputYear)
                        break;
                }

                if (!_.isNumber(prevYear) || !_.isNumber(nextYear) || prevYear > inputYear || nextYear < inputYear)
                    return;

                var prev = dataByYear[prevYear].values[0],
                    next = dataByYear[nextYear].values[0],
                    progress = (inputYear-prevYear) / (nextYear-prevYear);

                currentData.push(_.extend({}, dataByYear[prevYear], {
                    values: [{
                        x: prev.x + (next.x-prev.x)*progress,
                        y: prev.y + (next.y-prev.y)*progress,
                        size: prev.size + (next.size-prev.size)*progress
                    }]
                }))
            });

            return currentData;
/*                var prevData = dataByEntityAndYear[interpolation.prevYear],
                    nextData = dataByEntityAndYear[interpolation.nextYear],
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
                });*/
        });

        var _scatter = owid.view.scatter();
        viz.flow('scatter : chart', function(chart) {
            return _scatter;
        });

        viz.flow('scatterAxis : axisConfig, xDomain, yDomain', function(axisConfig, xDomain, yDomain) {
            var scatterAxis = _.clone(axisConfig);
            scatterAxis.x.domain = xDomain;
            scatterAxis.y.domain = yDomain;
            return scatterAxis;
        });

        viz.flow('scatter, svg, currentData, bounds, scatterAxis, timeline, xDomain, yDomain', function(scatter, svg, currentData, bounds, scatterAxis, timeline, xDomain, yDomain) {
            var timelineHeight = timeline.years.length > 1 ? timeline.bounds.height : 0;

            scatter.update({
                svg: svg,
                data: currentData,
                bounds: _.extend({}, bounds, { height: bounds.height-timelineHeight-10 }),
                axisConfig: scatterAxis
            });
        });

        viz.flow('scatter, isInterpolating', function(scatter, isInterpolating) {
            scatter.update({ canHover: !isInterpolating });
        });

        return viz;
    };
})(d3v4);