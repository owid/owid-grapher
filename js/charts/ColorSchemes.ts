import * as _ from 'lodash'
import * as colorbrewer from 'colorbrewer'
import Color from './Color'

var longSchemeNames: {[key: string]: string} = {
	'YlGn': 'Yellow-Green shades',
	'YlGnBu': 'Yellow-Green-Blue shades',
	'GnBu': 'Green-Blue shades',
	'BuGn': 'Blue-Green shades',
	'PuBuGn': 'Purple-Blue-Green shades',
	'BuPu': 'Blue-Purple shades',
	'RdPu': 'Red-Purple shades',
	'PuRd': 'Purple-Red shades',
	'OrRd': 'Orange-Red shades',
	'YlOrRd': 'Yellow-Orange-Red shades',
	'YlOrBr': 'Yellow-Orange-Brown shades',
	'Purples': 'Purple shades',
	'Blues': 'Blue shades',
	'Greens': 'Green shades',
	'Oranges': 'Orange shades',
	'Reds': 'Red shades',
	'Greys': 'Grey shades',
	'PuOr': 'Purple-Orange',
	'BrBG': 'Brown-Blue-Green',
	'PRGn': 'Purple-Red-Green',
	'PiYG': 'Magenta-Yellow-Green',
	'RdBu': 'Red-Blue',
	'RdGy': 'Red-Grey',
	'RdYlBu': 'Red-Yellow-Blue',
	'Spectral': 'Spectral colors',
	'RdYlGn': 'Red-Yellow-Green',
	'Accent': 'Accents',
	'Dark2': 'Dark colors',
	'Paired': 'Paired colors',
	'Pastel1': 'Pastel 1 colors',
	'Pastel2': 'Pastel 2 colors',
	'Set1': 'Set 1 colors',
	'Set2': 'Set 2 colors',
	'Set3': 'Set 3 colors',
	'PuBu': 'Purple-Blue shades',
	'hsv-RdBu': 'HSV Red-Blue',
	'hsv-CyMg': 'HSV Cyan-Magenta'
};

export interface ColorScheme {
	name: string
	colors: Color[][]
}

export default (function() {
	const colorSchemes: {[key: string]: ColorScheme} = {};

	_.each(colorbrewer, (colorSets: {[i: string]: Color[]}, schemeKey) => {
		colorSchemes[schemeKey] = { name: longSchemeNames[schemeKey]||"", "colors": [] };

		_.each(colorSets, (colors, i) => {
			if (i == "3")
				colorSchemes[schemeKey].colors[2] = [colors[0], colors[colors.length-1]];
			colorSchemes[schemeKey].colors[+i] = colors;
		})
	})

	var distinctScheme: ColorScheme = { name: "OWID Distinct", colors: [] };
	var distinctColors = ["#3360a9", "#ca2628", "#34983f", "#ed6c2d", "#df3c64", "#a85a4a", "#e6332e", "#6bb537", "#ffd53e", "#f07f59", "#b077b1", "#932834", "#674c98", "#5eb77e", "#f6a324", "#2a939b", "#818282", "#7ec7ce", "#fceb8c", "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", "#f9bc8f", "#d26e66", "#c8c8c8"];
	_.each(distinctColors, function(v, i) {
		distinctScheme.colors.push(distinctColors.slice(0, i));
	});
	colorSchemes["owid-distinct"] = distinctScheme;
	colorSchemes["custom"] = { name: "custom", colors: []};

	return colorSchemes;
})();
