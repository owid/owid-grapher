import {rgb} from 'd3-color'
import {interpolate} from 'd3-interpolate'
import {clone, first, last} from './Util'
import * as colorbrewer from 'colorbrewer'
import Color from './Color'

const longSchemeNames: {[key: string]: string} = {
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

export class ColorScheme {
	name: string
	colorSets: Color[][] // Different color sets depending on how many distinct colors you want

	constructor(name: string, colorSets: Color[][]) {
		this.name = name
		this.colorSets = []
		colorSets.forEach(set => this.colorSets[set.length] = set)
	}

	static fromObject(name: string, colorSets: {[key: string]: Color[]}) {
		const colorSetsArray: Color[][] = []
		Object.keys(colorSets).forEach(numColors => colorSetsArray[+numColors] = colorSets[numColors])
		return new ColorScheme(name, colorSetsArray)
	}

	// Expand a gradient color set by interpolating between points to create new colors
	improviseGradientFromShorter(shortColors: Color[], numColors: number) {
		const newColors = clone(shortColors)

		while (newColors.length < numColors) {
			for (var i = newColors.length-1; i > 0; i -= 1) {
				var startColor = rgb(newColors[i-1]);
				var endColor = rgb(newColors[i]);
				var newColor = interpolate(startColor, endColor)(0.5);
				newColors.splice(i, 0, newColor);

				if (newColors.length >= numColors) break;
			}
		}

		console.log(shortColors, newColors)

		return newColors
	}

	getGradientColors(numColors: number): Color[] {        
		const {colorSets} = this

		if (colorSets[numColors])
			return colorSets[numColors]
		else {
			const prevColors = clone(colorSets).reverse().find(set => set.length < numColors)
			if (prevColors)
				return this.improviseGradientFromShorter(prevColors, numColors)
			else
				return first(colorSets).slice(0, numColors)
		}
	}

	getDistinctColors(numColors: number): Color[] {        
		const {colorSets} = this

		if (colorSets[numColors])
			return colorSets[numColors]
		else if (numColors > colorSets.length-1) // If more colors are wanted than we have defined, have to improvise
			return this.improviseGradientFromShorter(last(colorSets), numColors)
		else {
			// We have enough colors but not a specific set for this number-- improvise from the closest longer set
			for (var i = numColors; i < colorSets.length; i++) {
				if (colorSets[i]) {
					return colorSets[i].slice(0, numColors)
				}
			}
			
			return []
		}
	}
}

export default (function() {
	const colorSchemes: {[key: string]: ColorScheme} = {};

	// Create some of our own!
	colorSchemes['owid-distinct'] = new ColorScheme(
		"OWID Distinct",
		[
            ["#3360a9", "#ca2628", "#34983f", "#f6a324", "#a652ba", 
             "#2a939b", "#e6332e", "#9ecc8a", "#ffd53e", "#b077b1", 
             "#df3c64", "#e6332e", "#6bb537", "#f07f59", "#932834", 
             "#5eb77e", "#818282", "#7ec7ce", "#fceb8c", 
             "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", 
             "#f9bc8f", "#d26e66", "#c8c8c8", "#ed6c2d"]
		]
	)

	// Create a ColorScheme for each colorbrewer scheme
	for (let schemeKey in colorbrewer) {
		const name = longSchemeNames[schemeKey] || schemeKey
		const colorSets: {[numColors: string]: Color[]} = (colorbrewer as any)[schemeKey]
		colorSchemes[schemeKey] = ColorScheme.fromObject(name, colorSets)
	}


	colorSchemes['stackedAreaDefault'] = new ColorScheme(
		"OWID 4 Color Gradient",
		[
            ["#ca2628", "#ffd53e", "#34983f", "#3360a9", "#a652ba", "#9ecc8a", "#e6332e", "#ed6c2d", "#df3c64", "#e6332e", "#6bb537", "#f07f59", "#b077b1", "#932834", "#5eb77e", "#f6a324", "#2a939b", "#818282", "#7ec7ce", "#fceb8c", "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", "#f9bc8f", "#d26e66", "#c8c8c8"]
		]
	)

	return colorSchemes;
})();

