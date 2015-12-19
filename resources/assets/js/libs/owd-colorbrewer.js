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