
// We import and re-export all the lodash functions we're using here to allow
// webpack to tree-shake and remove the ones we're not using from the bundle
import map from 'lodash-es/map'
import sortBy from 'lodash-es/sortBy'
import each from 'lodash-es/each'
import keys from 'lodash-es/keys'
import trim from 'lodash-es/trim'
import isNumber from 'lodash-es/isNumber'
import filter from 'lodash-es/filter'
import extend from 'lodash-es/extend'
import isEmpty from 'lodash-es/isEmpty'
import isFinite from 'lodash-es/isFinite'
import some from 'lodash-es/some'
import every from 'lodash-es/every'
import min from 'lodash-es/min'
import max from 'lodash-es/max'
import uniq from 'lodash-es/uniq'
import cloneDeep from 'lodash-es/cloneDeep'
import sum from 'lodash-es/sum'
import find from 'lodash-es/find'
import identity from 'lodash-es/identity'
import union from 'lodash-es/union'
import debounce from 'lodash-es/debounce'
import includes from 'lodash-es/includes'
import toString from 'lodash-es/toString'
import isString from 'lodash-es/isString'
import keyBy from 'lodash-es/keyBy'
import values from 'lodash-es/values'
import flatten from 'lodash-es/flatten'
import groupBy from 'lodash-es/groupBy'
import reverse from 'lodash-es/reverse'
import clone from 'lodash-es/clone'
import reduce from 'lodash-es/reduce'
import noop from 'lodash-es/noop'
import floor from 'lodash-es/floor'
import ceil from 'lodash-es/ceil'
import round from 'lodash-es/round'
import toArray from 'lodash-es/toArray'
import throttle from 'lodash-es/throttle'
import has from 'lodash-es/has'
import intersection from 'lodash-es/intersection'
import uniqWith from 'lodash-es/uniqWith'
import without from 'lodash-es/without'
import uniqBy from 'lodash-es/uniqBy'
import sortedUniq from 'lodash-es/sortedUniq'

import capitalize from 'lodash-es/capitalize'
import sample from 'lodash-es/sample'
import sampleSize from 'lodash-es/sampleSize'
import pick from 'lodash-es/pick'
import difference from 'lodash-es/difference'

export {map, sortBy, each, keys, trim, isNumber, filter, extend, isEmpty, isFinite, some, every, min, max, uniq, cloneDeep, sum, find, identity, union, debounce, includes, toString, isString, keyBy, values, flatten, groupBy, reverse, clone, reduce, noop, floor, ceil, round, toArray, throttle, has, intersection, uniqWith, without, uniqBy, capitalize, sample, sampleSize, pick, difference, sortedUniq}

import {format} from 'd3-format'
import {extent} from 'd3-array'

import Vector2 from './Vector2'

export type SVGElement = any;
export type VNode = any;

export function getRelativeMouse(node: SVGElement, event: any): Vector2 {
    let clientX, clientY
    if ((event as MouseEvent).clientX != null) {
        clientX = (event as MouseEvent).clientX
        clientY = (event as MouseEvent).clientY
    } else {
        clientX = (event as TouchEvent).targetTouches[0].clientX
        clientY = (event as TouchEvent).targetTouches[0].clientY
    }

  var svg = node.ownerSVGElement || node;

  if (svg.createSVGPoint) {
    var point = svg.createSVGPoint()
    point.x = clientX, point.y = clientY
    point = point.matrixTransform(node.getScreenCTM().inverse())
    return new Vector2(point.x, point.y)
  }

  var rect = node.getBoundingClientRect()
  return new Vector2(clientX - rect.left - node.clientLeft, clientY - rect.top - node.clientTop)
};

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
    each(keys(props), (key: string) => {
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
		unitSuffix = (unit.unit ? trim(unit.unit) : "");

	// Do precision fiddling, if the value is numeric
	if (isNumber(value)) {
		if (value % 1 == 0 && Math.abs(value) >= 1e6) {
			if (value >= 1e12) value = value/1e12 + " trillion"
			else if (value >= 1e9) value = value/1e9 + " billion"
			else if (value >= 1e6) value = value/1e6 + " million"
		} else {
            const unitFormat = parseInt(unit.format)
			if (isFinite(unitFormat) && unitFormat >= 0) {
				var fixed = Math.min(20, unit.format);
				value = format("." + fixed + "f")(value);
			} else {
				value = format(",")(value);
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
	const isNoSpaceUnit = unit[0] == "%"

	let output: string = value.toString()
	
	if (!isNoSpaceUnit && Math.abs(value) >= 1e6) {
		if (value >= 1e12) 
			output = formatValue(value/1e12, extend({}, options, { unit: "trillion" }))
		else if (value >= 1e9) 
			output = formatValue(value/1e9, extend({}, options, { unit: "billion" }))
		else if (value >= 1e6) 
			output = formatValue(value/1e6, extend({}, options, { unit: "million" }))
	} else {
		if (maxDecimalPlaces >= 0 && value % 1 != 0) {
			var fixed = Math.min(20, maxDecimalPlaces);
			output = format(",." + fixed + "f")(value);
		} else {
			output = format(",")(value);
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
	else if (isNoSpaceUnit) {
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
	const querySplit = filter(queryStr.split("&"), function(s) { return !isEmpty(s); })
	const params: QueryParams = {};

	for (var i = 0; i < querySplit.length; i++) {
		var pair = querySplit[i].split("=");
		params[pair[0]] = pair[1];
	}

	return params;
};

export function queryParamsToStr(params: QueryParams) {
	var newQueryStr = "";

	each(params, function(v,k) {
        if (v == undefined) return
        
		if (isEmpty(newQueryStr)) newQueryStr += "?";
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
	const [min, max] = extent(values)

	if (isFinite(min) && isFinite(max) && min != max) {
		return [min, max] as [number, number]
	} else {
		return scaleType == 'log' ? [1, 100] : [-1, 1]
	}
}

// Take an arbitrary string and turn it into a nice url slug
export function slugify(s: string) {
	s = s.toLowerCase().replace(/\s*\*.+\*/, '').replace(/[^\w- ]+/g,'');
	return trim(s).replace(/ +/g,'-');
}


export function findClosest(values: number[], targetValue: number): number|undefined {
	return sortBy(values, value => Math.abs(value-targetValue))[0];	
}