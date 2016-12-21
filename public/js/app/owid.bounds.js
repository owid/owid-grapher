(function() {
    "use strict";
    owid.namespace("owid.bounds");

    owid.bounds = function() {
        var bounds = {};

        if (arguments.length == 4) {
            bounds.left = arguments[0];
            bounds.top = arguments[1];
            bounds.width = arguments[2];
            bounds.height = arguments[3];
        } else if (_.isObject(arguments[0])) {
            _.extend(bounds, arguments[0]);
        }

        bounds.pad = function() {
            var padLeft = 0, padRight = 0, padTop = 0, padBottom = 0;

            if (arguments.length == 1) {
                padLeft = arguments[0];
                padRight = arguments[0];
                padTop = arguments[0];
                padBottom = arguments[0];
            } else if (arguments.length == 2) {
                padLeft = arguments[0];
                padRight = arguments[0];
                padTop = arguments[1];
                padBottom = arguments[1];
            }

            return owid.bounds(bounds.left+padLeft, bounds.top+padTop, bounds.width-(padLeft+padRight), bounds.height-(padTop+padBottom));
        };

        bounds.padTop = function(padding) {
            return owid.bounds(bounds.left, bounds.top+padding, bounds.width, bounds.height-padding);
        };

        bounds.padLeft = function(padding) {
            return owid.bounds(bounds.left+padding, bounds.top, bounds.width-padding, bounds.height);
        };

        bounds.padBottom = function(padding) {
            return owid.bounds(bounds.left, bounds.top, bounds.width, bounds.height-padding);
        };

        bounds.padRight = function(padding) {
            return owid.bounds(bounds.left, bounds.top, bounds.width-padding, bounds.height);
        };

        bounds.scale = function(scale) {
            return owid.bounds(bounds.left*scale, bounds.top*scale, bounds.width*scale, bounds.height*scale);
        };

        return bounds;
    };
})();

