// http://colorbrewer.org/ with added binary scaleThis product includes color specifications and designs developed by Cynthia Brewer (http://colorbrewer.org/).
var owdColorbrewer = {};

for( var schemeName in colorbrewer ) {

	var longSchemeNames = {
		'YlGn':'Yellow-Green shades',
		'YlGnBu':'Yellow-Green-Blue shades',
		'GnBu':'Green-Blue shades',
		'BuGn':'Blue-Green shades',
		'PuBuGn':'Purple-Blue-Green shades',
		'BuPu':'Blue-Purple shades',
		'RdPu':'Red-Purple shades',
		'PuRd':'Purple-Red shades',
		'OrRd':'Orange-Red shades',
		'YlOrRd':'Yellow-Orange-Red shades',
		'YlOrBr':'Yellow-Orange-Brown shades',
		'Purples':'Purple shades',
		'Blues':'Blue shades',
		'Greens':'Green shades',
		'Oranges':'Orange shades',
		'Reds':'Red shades',
		'Greys':'Grey shades',
		'PuOr':'Purple-Orange',
		'BrBG':'Brown-Blue-Green',
		'PRGn':'Purple-Red-Green',
		'PiYG':'Magenta-Yellow-Green',
		'RdBu':'Red-Blue',
		'RdGy':'Red-Grey',
		'RdYlBu':'Red-Yellow-Blue',
		'Spectral':'Spectral colors',
		'RdYlGn':'Red-Yellow-Green',
		'Accent':'Accents',
		'Dark2':'Dark colors',
		'Paired':'Paired colors',
		'Pastel1': 'Pastel 1 colors',
		'Pastel2': 'Pastel 2 colors',
		'Set1': 'Set 1 colors',
		'Set2': 'Set 2 colors',
		'Set3': 'Set 3 colors',
		'PuBu':'Purple-Blue shades',
		'hsv-RdBu':'HSV Red-Blue',
		'hsv-CyMg':'HSV Cyan-Magenta'};

	var colorSchemes = colorbrewer[ schemeName ],
		longSchemeName = ( longSchemeNames[ schemeName ] )? longSchemeNames[ schemeName ] : "";

	owdColorbrewer[ schemeName ] = { name: longSchemeName, "colors": [] };
	for( var i in colorSchemes ) {

		var scheme = colorSchemes[ i ];
		if( i === "3" ) {
			//add extra binary scheme 
			owdColorbrewer[ schemeName ][ "colors" ][ 2 ] = [ scheme[ 0 ], scheme[ scheme.length - 1 ] ];
		}
		//and copy the others from color brewer
		owdColorbrewer[ schemeName ][ "colors" ][ i ] = scheme;
	
	}
}

owdColorbrewer[ "custom" ] = { "name": "custom", "colors": []};

owdColorbrewer.getColors = function(mapConfig) {
	var colorSchemeName = mapConfig.colorSchemeName || "",
		colorSchemeInterval = mapConfig.colorSchemeInterval || 2,
		colorSchemeInvert = mapConfig.colorSchemeInvert || false,
		customColorScheme = mapConfig.customColorScheme || [];

	if (colorSchemeInvert) {
		var colors = this.getColors(_.extend({}, mapConfig, { colorSchemeInvert: false }));
		return colors.reverse();
	}

	if (colorSchemeName === "custom")
		return _.clone(customColorScheme);

	var scheme = owdColorbrewer[colorSchemeName];
	if (!scheme) {
		console.error("No such color scheme: " + scheme);
		// Return a default color scheme
		return this.getColors(_.extend({}, mapConfig, { colorSchemeName: _.keys(owdColorbrewer)[0] }));
	}

	if (!_.isEmpty(scheme.colors[colorSchemeInterval]))
		return _.clone(scheme.colors[colorSchemeInterval]);

	// Handle the case of a single color (just for completeness' sake)
	if (colorSchemeInterval == 1 && !_.isEmpty(scheme.colors[2]))
		return [scheme.colors[2][0]];

	// If there's no preset color scheme for this many colors, improvise a new one
	var colors = _.clone(scheme.colors[scheme.colors.length-1]);
	while (colors.length < colorSchemeInterval) {
		for (var i = 1; i < colors.length; i++) {
			var startColor = d3.rgb(colors[i-1]);
			var endColor = d3.rgb(colors[i]);
			var newColor = d3.interpolate(startColor, endColor)(0.5);
			colors.splice(i, 0, newColor);
			i += 1;

			if (colors.length >= colorSchemeInterval) break;
		}		
	}
	return colors;
};
