import Importer from './Importer'
import React, {Component} from 'react'
import {render} from 'preact'

let rootNode
export default owid.View.extend({
	el: "#import-view",

	initialize: function(props) {	
		$("#import-view").empty()
	    rootNode = render(<Importer datasets={props.datasets} categories={props.categories} sourceTemplate={props.sourceTemplate.meta_value} existingEntities={props.entityNames}/>, $("#import-view")[0], rootNode)
	}
});