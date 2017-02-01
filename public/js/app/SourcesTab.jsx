// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import React, {Component} from 'react'
import {render} from 'preact'
import owid from '../owid'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {NullElement} from './Util'

@observer
export default class SourcesTab extends Component {
	props: {
		bounds: Bounds,
		sources: Object[]
	}

	@computed get bounds() : Bounds {
		return this.props.bounds
	}

	@computed.struct get sources() : Object[] {
		return this.props.sources
	}

	render() {
		const { bounds, sources } = this

		return <div class="sourcesTab" style={_.extend(bounds.toCSS(), { position: 'absolute' })}>
			<div>
				<h2>Sources</h2>
				<div dangerouslySetInnerHTML={{__html: _.pluck(sources, 'description').join(' ') }} />
			</div>
		</div>
	}
}

;(function() {	
	"use strict";
	owid.namespace("owid.component.sourcesTab");

	owid.component.sourcesTab = function(chart) {
		var sourcesTab = owid.dataflow();

		sourcesTab.isOverlay = true;

		let rootNode = null

		sourcesTab.render = function(bounds) {
	        rootNode = render(<SourcesTab bounds={bounds.scale(chart.scale)} sources={chart.data.transformDataForSources()}/>, chart.htmlNode, rootNode)
		};

		sourcesTab.beforeClean(function() {
			rootNode = render(NullElement, chart.htmlNode, rootNode);
		});

		return sourcesTab;
	};
})();