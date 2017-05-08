import owid from '../owid'

export default function(chart) {
    function tooltip() {}

    var $tooltip = $('<div class="nvtooltip tooltip-xy owid-tooltip"></div>');
    $('body').append($tooltip);
    $tooltip.hide();

    tooltip.fromMap = function(d, ev) {
        var datum = chart.mapdata.currentValues[d.id],
            availableEntities = chart.vardata.get("availableEntities"),
            entity = _.find(availableEntities, function(e) {
                return owid.entityNameForMap(e.name) == d.id;
            });

        if (!datum || !entity) {
            // No data available
            $tooltip.hide();
        } else {
            //transform datamaps data into format close to nvd3 so that we can reuse the same popup generator
            var variableId = App.MapModel.get("variableId"),
                propertyName = owid.getPropertyByVariableId(App.ChartModel, variableId) || "y";

            var obj = {
                point: {
                    time: datum.year
                },
                series: [{
                    key: entity.name
                }]
            };
            obj.point[propertyName] = datum.value;
            $tooltip.html(owid.contentGenerator(obj, true));

            $tooltip.css({
                position: 'absolute',
                left: ev.pageX,
                top: ev.pageY
            });
            $tooltip.show();
        }
    };

    tooltip.hide = function() {
        $tooltip.hide();
    };

    return tooltip;
};
