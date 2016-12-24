(function() {
    "use strict";
    owid.namespace("owid.bounds");

    var bounds = function() { };

    bounds.prototype.pad = function() {
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

        return owid.bounds(this.left+padLeft, this.top+padTop, this.width-(padLeft+padRight), this.height-(padTop+padBottom));
    };

    bounds.prototype.padTop = function(padding) {
        return owid.bounds(this.left, this.top+padding, this.width, this.height-padding);
    };

    bounds.prototype.padLeft = function(padding) {
        return owid.bounds(this.left+padding, this.top, this.width-padding, this.height);
    };

    bounds.prototype.padBottom = function(padding) {
        return owid.bounds(this.left, this.top, this.width, this.height-padding);
    };

    bounds.prototype.padRight = function(padding) {
        return owid.bounds(this.left, this.top, this.width-padding, this.height);
    };

    bounds.prototype.scale = function(scale) {
        return owid.bounds(this.left*scale, this.top*scale, this.width*scale, this.height*scale);
    };

    owid.bounds = function() {
        var b = new bounds();

        if (arguments.length == 4) {
            b.left = arguments[0];
            b.top = arguments[1];
            b.width = arguments[2];
            b.height = arguments[3];
        } else if (_.isObject(arguments[0])) {
            var obj = arguments[0];
            b.left = obj.left || obj.x;
            b.top = obj.top || obj.y;
            b.width = obj.width;
            b.height = obj.height;
        }

        return b;
    };
})();

