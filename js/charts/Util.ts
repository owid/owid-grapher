import * as _ from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import Vector2 from './Vector2'

export type SVGElement = any;
export type VNode = any;
export const NullElement : any = (): null => null;

export function getRelativeMouse(node: SVGElement, event: Object): Vector2 {
    let clientX, clientY
    if (_.isFinite((event as MouseEvent).clientX)) {
        clientX = (event as MouseEvent).clientX
        clientY = (event as MouseEvent).clientY
    } else {
        clientX = (event as TouchEvent).targetTouches[0].clientX
        clientY = (event as TouchEvent).targetTouches[0].clientY
    }

  var svg = node.ownerSVGElement || node;

  if (svg.createSVGPoint) {
    var point = svg.createSVGPoint();
    point.x = clientX, point.y = clientY;
    point = point.matrixTransform(node.getScreenCTM().inverse());
    return new Vector2(point.x, point.y);
  }

  var rect = node.getBoundingClientRect();
  return new Vector2(clientX - rect.left - node.clientLeft, clientY - rect.top - node.clientTop);
};

// Create an instance of a JSX node before rendering
// Used for when we need to precalculate bounds
export function preInstantiate(vnode: VNode) {
    return new vnode.nodeName(vnode.props)
}


// Make an arbitrary string workable as a css class name
export function makeSafeForCSS(name: string) {
    return name.replace(/[^a-z0-9]/g, function(s) {
        var c = s.charCodeAt(0);
        if (c == 32) return '-';
        if (c == 95) return '_';
        if (c >= 65 && c <= 90) return s;
        return '__' + ('000' + c.toString(16)).slice(-4);
    });
};

// Transform entity name to match counterpart in world.ids.json
// Covers e.g. Cote d'Ivoire -> Cote_d_Ivoire
// Also removes non-ascii characters which may break datamaps
export function entityNameForMap(name: string) {
    return makeSafeForCSS(name.replace(/[ '&:\(\)\/]/g, "_"));
};

export function formatYear(year: number): string {
    if (isNaN(year)) {
        console.error("Invalid year '" + year + "'");
        return "";
    }

    if (year < 0)
        return Math.abs(year) + " BCE";
    else
        return year.toString();
}

export function numberOnly(value: any): number|undefined {
    const number = parseFloat(value)
    if (isNaN(number))
        return undefined
    else
        return number
}

// Bind a "mobx component"
// Still working out exactly how this pattern goes
export function component<T extends {[key: string]: any}>(current: T|undefined, klass: { new(): T }, props: Partial<T>): T {
    const instance = current || new klass()
    _.each(_.keys(props), (key: string) => {
        instance[key] = props[key]
    })
    return instance
}

// Todo: clean this up a bit, it's from old stuff
export function unitFormat(unit: any, value: any, options?: any): string {
	if (value === "") return "";

	unit = unit || {};
	options = options || {};
	options.noTrailingZeroes = options.noTrailingZeroes || true;

	var titlePrefix = (unit.title ? unit.title + ": " : ""),
		unitSuffix = (unit.unit ? _.trim(unit.unit) : "");

	// Do precision fiddling, if the value is numeric
	if (_.isNumber(value)) {
		if (value % 1 == 0 && Math.abs(value) >= 1e6) {
			if (value >= 1e12) value = value/1e12 + " trillion"
			else if (value >= 1e9) value = value/1e9 + " billion"
			else if (value >= 1e6) value = value/1e6 + " million"
		} else {
            const unitFormat = parseInt(unit.format)
			if (_.isFinite(unitFormat) && unitFormat >= 0) {
				var fixed = Math.min(20, unit.format);
				value = d3.format("." + fixed + "f")(value);
			} else {
				value = d3.format(",")(value);
			}

			if (options.noTrailingZeroes) {
				var m = value.match(/([0-9,-]+.[0-9,]*?)0*$/);
				if (m) value = m[1];
				if (value[value.length-1] == ".")
					value = value.slice(0, value.length-1);
			}
		}
	}

	if (unitSuffix == "$" || unitSuffix == "£")
		return titlePrefix + unitSuffix + value;
	else {
		if (unitSuffix && unitSuffix[0] != "%")
			unitSuffix = " " + unitSuffix;
		return titlePrefix + value + unitSuffix;
	}
};

export function formatValue(value: number, options: { maxDecimalPlaces?: number, unit?: string }): string {
	const noTrailingZeroes = true
	const maxDecimalPlaces = defaultTo(options.maxDecimalPlaces, 2)
	const unit = defaultTo(options.unit, "")

	let output: string = value.toString()
	
	if (!unit && Math.abs(value) >= 1e6) {
		if (value >= 1e12) 
			return formatValue(value/1e12, _.extend({}, options, { unit: "trillion" }))
		else if (value >= 1e9) 
			return formatValue(value/1e9, _.extend({}, options, { unit: "billion" }))
		else if (value >= 1e6) 
			return formatValue(value/1e6, _.extend({}, options, { unit: "million" }))
	} else {
		if (maxDecimalPlaces >= 0 && value % 1 != 0) {
			var fixed = Math.min(20, maxDecimalPlaces);
			output = d3.format(",." + fixed + "f")(value);
		} else {
			output = d3.format(",")(value);
		}

		if (noTrailingZeroes) {
			var m = output.match(/([0-9,-]+.[0-9,]*?)0*$/);
			if (m) output = m[1];
			if (output[output.length-1] == ".")
				output = output.slice(0, output.length-1);
		}
	}

	if (unit == "$" || unit == "£")
		output = unit + output;
	else if (unit[0] == "%" || unit.length == 1) {
		output = output + unit
	} else if (unit.length > 0) {
		output = output + " " + unit
	}
	
	return output
}


export function defaultTo<T, K>(value: T|undefined|null, defaultValue: K): T|K {
    if (value == null) return defaultValue
    else return value
}

export function first<T>(arr: T[]) { return arr[0] }
export function last<T>(arr: T[]) { return arr[arr.length-1] }

export type QueryParams = {[key: string]: string}

export function getQueryParams(queryStr?: string): QueryParams {
	queryStr = queryStr || window.location.search.substring(1)
	const querySplit = _.filter(queryStr.split("&"), function(s) { return !_.isEmpty(s); })
	const params: QueryParams = {};

	for (var i = 0; i < querySplit.length; i++) {
		var pair = querySplit[i].split("=");
		params[pair[0]] = pair[1];
	}

	return params;
};

export function queryParamsToStr(params: QueryParams) {
	var newQueryStr = "";

	_.each(params, function(v,k) {
        if (v == undefined) return
        
		if (_.isEmpty(newQueryStr)) newQueryStr += "?";
		else newQueryStr += "&";
		newQueryStr += k + '=' + v;
	});

	return newQueryStr;
};

export function setQueryVariable(key: string, val: string|null) {
	var params = getQueryParams();
	
	if (val == null || val == "") {
		delete params[key];
	} else {
		params[key] = val;
	}

	setQueryStr(queryParamsToStr(params));
};

export function setQueryStr(str: string) {
	history.replaceState(null, document.title, window.location.pathname + str + window.location.hash);
};


// Calculate the extents of a set of numbers, with safeguards for log scales
export function domainExtent(values: number[], scaleType: 'linear'|'log'): [number, number] {
	if (scaleType == 'log')
		values = values.filter(v => v > 0)
	const [min, max] = d3.extent(values)

	if (_.isFinite(min) && _.isFinite(max) && min != max) {
		return [min, max] as [number, number]
	} else {
		return scaleType == 'log' ? [1, 100] : [-1, 1]
	}
}

// Take an arbitrary string and turn it into a nice url slug
export function slugify(s: string) {
	s = s.toLowerCase().replace(/\s*\*.+\*/, '').replace(/[^\w- ]+/g,'');
	return _.trim(s).replace(/ +/g,'-');
}


export function findClosest(values: number[], targetValue: number): number|undefined {
	return _.sortBy(values, value => Math.abs(value-targetValue))[0];	
}