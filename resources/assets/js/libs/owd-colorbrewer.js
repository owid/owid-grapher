// http://colorbrewer.org/ with added binary scaleThis product includes color specifications and designs developed by Cynthia Brewer (http://colorbrewer.org/).
var owdColorbrewer = {};
for( var schemeName in colorbrewer ) {

	var colorSchemes = colorbrewer[ schemeName ];

	owdColorbrewer[ schemeName ] = {};
	for( var i in colorSchemes ) {

		var scheme = colorSchemes[ i ];
		if( i === "3" ) {
			//add extra binary scheme 
			owdColorbrewer[ schemeName ][ 2 ] = [ scheme[ 0 ], scheme[ scheme.length - 1 ] ];
		}
		//and copy the others from color brewer
		owdColorbrewer[ schemeName ][ i ] = scheme;

	}

}
owdColorbrewer[ "custom" ] = {};