import * as d3 from 'd3'
import _ from 'lodash'
import dataflow from './owid.dataflow'
import owid from '../owid'
import Scatter from './owid.view.scatter'
import Timeline from './owid.view.timeline'

export default function() {
    var control = dataflow();

    var colorScheme = [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
            "#5675c1", // Africa
            "#aec7e8", // Antarctica
            "#d14e5b", // Asia
            "#ffd336", // Europe
            "#4d824b", // North America
            "#a652ba", // Oceania
            "#69c487", // South America
            "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]


    var hasTimeline = null;
    control.update = function(props, callback) {
        var shouldHaveTimeline = !!props.timelineConfig;

        if (hasTimeline != shouldHaveTimeline) {
            if (control.scatter) control.scatter.clean();

            control.scatter = shouldHaveTimeline ? scatterWithTimeline() : scatterWithoutTimeline();

            hasTimeline = shouldHaveTimeline;
        }

        if (!hasTimeline) props = _.omit(props, 'timelineConfig', 'inputYear');
        control.scatter.update(_.extend({}, props, { colorScheme: colorScheme }), callback);
    };

    control.beforeClean(function() {
        if (control.scatter) control.scatter.clean();
    });

    return control;
};

const scatterWithoutTimeline = function() {
    var viz = dataflow();

    viz.needs('containerNode', 'bounds', 'axisConfig', 'dimensions', 'variables', 'colorScheme');

    // Color scale for color dimension
    viz.flow('colorScale : colorScheme', function(colorScheme) {
        return d3.scaleOrdinal().range(colorScheme);
    });

    // Set domain for color scale now to get the right ordering
    viz.flow('colorScale, dimensions, variables', function(colorScale, dimensions, variables) {
        var colorDim = _.find(dimensions, { property: 'color' });
        if (!colorDim) return;

        var variable = variables[colorDim.variableId];
        colorScale.domain(variable.categoricalValues);
    }); 

    viz.flow('data : dimensions, variables, colorScale', function(dimensions, variables, colorScale) {
        var dataByEntity = {};

        _.each(dimensions, function(dimension) {
            var variable = variables[dimension.variableId],
                targetYear = _.isFinite(dimension.targetYear) ? dimension.targetYear : _.last(variable.years),
                tolerance = _.isFinite(dimension.tolerance) ? dimension.tolerance : 0;

            if (dimension.property == 'color' || dimension.property == 'size')
                tolerance = Infinity;

            for (var i = 0; i < variable.years.length; i++) {
                var year = variable.years[i],
                    value = variable.values[i],
                    entityId = variable.entities[i],
                    entity = variable.entityKey[entityId];

                // Skip years that aren't within tolerance of the target
                if (year < targetYear-tolerance || year > targetYear+tolerance)
                    continue;

                var series = owid.default(dataByEntity, entityId, {
                    id: entityId,
                    label: entity.name,
                    key: entity.name,
                    values: [{ time: {} }]
                });

                // Ensure we use the closest year to the target
                var currentYear = series.values[0].time[dimension.property];
                if (_.isFinite(currentYear) && Math.abs(targetYear-currentYear) < Math.abs(year-currentYear))
                    continue;

                var d = series.values[0];
                d.time[dimension.property] = year;

                if (dimension.property == 'color')
                    series.color = colorScale(value);
                else
                    d[dimension.property] = value;
            }
        });

        var data = [];

        // Exclude any with data for only one axis
        _.each(dataByEntity, function(series) {
            var datum = series.values[0];
            if (_.has(datum, 'x') && _.has(datum, 'y'))
                data.push(series);
        });

        return data;
    });

    viz.flow('minYear, maxYear : data', function(data) {
        return [
            _.min(_.map(data, function(d) { return _.min([d.values[0].time.x, d.values[0].time.y]); })),
            _.max(_.map(data, function(d) { return _.max([d.values[0].time.x, d.values[0].time.y]); }))
        ];
    });

    // hack to get data to header
    viz.flow('minYear, maxYear', function(minYear, maxYear) {
        chart.model.set('chart-time', [minYear, maxYear]);
    });

    viz.flow('scatter : containerNode', function(containerNode) {
        return Scatter();
    });

    viz.flow('scatter, containerNode, data, bounds, axisConfig', function(scatter, containerNode, data, bounds, axisConfig) {
        scatter.update({
            containerNode: containerNode,
            data: data,
            bounds: bounds,
            axisConfig: axisConfig
        });
    });

    viz.beforeClean(function() {
        if (viz.scatter) viz.scatter.clean();
    });

    return viz;
};

const scatterWithTimeline = function() {
    var viz = dataflow();

    viz.needs('containerNode', 'bounds', 'axisConfig', 'dimensions', 'variables', 'inputYear', 'timelineConfig', 'colorScheme');

    viz.flow('axisDimensions : dimensions', function(dimensions) {            
        return _.filter(dimensions, function(d) { return d.property == 'x' || d.property == 'y'; });
    });

    viz.flow('timeRanges, defaultYear, tolerance : timelineConfig', function(timelineConfig) {
        return [
            _.result(timelineConfig, 'timeRanges', null),
            _.result(timelineConfig, 'defaultYear', 'latest'),
            _.result(timelineConfig, 'tolerance', 0)
        ];
    });

    viz.flow('yearsWithData : axisDimensions, variables, tolerance', function(axisDimensions, variables, tolerance) {
        var yearSets = [];

        var minYear = _.min(_.map(axisDimensions, function(d) { 
            return _.first(variables[d.variableId].years);
        }));

        var maxYear = _.max(_.map(axisDimensions, function(d) {
            return _.last(variables[d.variableId].years);
        }));

        _.each(axisDimensions, function(dimension) {
            var variable = variables[dimension.variableId],
                yearsForVariable = {};

            _.each(_.uniq(variable.years), function(year) {
                for (var i = Math.max(minYear, year-tolerance); i <= Math.min(maxYear, year+tolerance); i++) {
                    yearsForVariable[i] = true;
                }
            });

            yearSets.push(_.map(_.keys(yearsForVariable), function(year) { return parseInt(year); }));
        });

        return _.sortBy(_.intersection.apply(_, yearSets));
    });        

    viz.flow('timelineYears : timeRanges, yearsWithData', function(timeRanges, yearsWithData) {
        return _.intersection(owid.timeRangesToYears(timeRanges, _.first(yearsWithData), _.last(yearsWithData)), yearsWithData);
    });

    // Set default input year if none is given
    viz.flow('inputYear : defaultYear, timelineYears', function(defaultYear, timelineYears) {     
        if (defaultYear == 'latest') return _.last(timelineYears);
        if (defaultYear == 'earliest') return _.first(timelineYears);
        return defaultYear;
    });

    // Color scale for color dimension
    viz.flow('colorScale : colorScheme', function(colorScheme) {
        return d3.scaleOrdinal().range(colorScheme);
    });

    // Set domain for color scale now to get the right ordering
    viz.flow('colorScale, dimensions, variables', function(colorScale, dimensions, variables) {
        var colorDim = _.find(dimensions, { property: 'color' });
        if (!colorDim) return;

        var variable = variables[colorDim.variableId];
        colorScale.domain(variable.categoricalValues);
    });

    // Precompute the data transformation for every timeline year (so later animation is fast)
    viz.flow('dataByEntityAndYear : timelineYears, dimensions, variables, tolerance, colorScale', function(timelineYears, dimensions, variables, configTolerance, colorScale) {
        var dataByEntityAndYear = {};

        // The data values
        _.each(dimensions, function(dimension) {
            var variable = variables[dimension.variableId],
                tolerance = (dimension.property == 'color' || dimension.property == 'size') ? Infinity : configTolerance;

            var targetYears = timelineYears;

            _.each(timelineYears, function(targetYear) {
                for (var i = 0; i < variable.years.length; i++) {
                    var year = variable.years[i],
                        value = variable.values[i],
                        entity = variable.entityKey[variable.entities[i]];

                    // Skip years that aren't within tolerance of the target
                    if (year < targetYear-tolerance || year > targetYear+tolerance)
                        continue;

                    var dataByYear = owid.default(dataByEntityAndYear, entity.id, {}),
                        series = owid.default(dataByYear, targetYear, {
                            id: entity.id,
                            label: entity.name,
                            key: entity.name,
                            values: [{ time: {} }]
                        });

                    var d = series.values[0];

                    // Ensure we use the closest year to the target
                    var currentYear = d.time[dimension.property];
                    if (_.isFinite(currentYear) && Math.abs(currentYear-targetYear) < Math.abs(year-targetYear))
                        continue;

                    if (dimension.property == 'color')
                        series.color = colorScale(value);
                    else {
                        d.time[dimension.property] = year;
                        d[dimension.property] = value;
                    }
                }
            });
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

    // hack
    viz.flow('timeline : containerNode', function(containerNode) {
        var timeline = Timeline();

        timeline.flow('targetYear', function(targetYear) {
            chart.model.set('chart-time', [targetYear, targetYear]);
        });

        return timeline;
    });

    viz.flow('timeline, containerNode, bounds, timelineYears, inputYear', function(timeline, containerNode, bounds, timelineYears, inputYear) {
        var timelineHeight = 25;
        timeline.update({
            containerNode: chart.svg.node(),
            outerBounds: { top: bounds.top+bounds.height-timelineHeight, left: bounds.left, width: bounds.width, height: timelineHeight },
            years: timelineYears,
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
            }));
        });

        return currentData;
    });

    viz.flow('scatter : containerNode', function(containerNode) {
        return Scatter();
    });

    // Calculate default domain (can be overriden by axis config)
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
    
    viz.flow('scatterAxis : axisConfig, xDomain, yDomain', function(axisConfig, xDomain, yDomain) {
        xDomain = _.extend([], xDomain, axisConfig.x.domain);
        yDomain = _.extend([], yDomain, axisConfig.y.domain);

        return {
            x: _.extend({}, axisConfig.x, { domain: xDomain }),
            y: _.extend({}, axisConfig.y, { domain: yDomain })
        };
    });

    viz.flow('scatter, containerNode, currentData, bounds, scatterAxis, timeline, timelineYears', function(scatter, containerNode, currentData, bounds, scatterAxis, timeline, timelineYears) {
        var timelineHeight = chart.isExport ? 0 : timeline.bounds.height+10;

        scatter.update({
            containerNode: containerNode,
            data: currentData,
            bounds: _.extend({}, bounds, { height: bounds.height-timelineHeight }),
            axisConfig: scatterAxis
        });
    });

    viz.flow('scatter, isInterpolating', function(scatter, isInterpolating) {
        scatter.update({ canHover: !isInterpolating });
    });

    viz.beforeClean(function() {
        if (viz.scatter) viz.scatter.clean();
        if (viz.timeline) viz.timeline.clean();
    });

    return viz;
};