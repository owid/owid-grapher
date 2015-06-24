<div id="chart-view" class="col-sm-12 col-md-6 chart-wrapper chart-edit-wrapper" @if (isset($chart)) data-chart-id="{{ $chart->id }}" @endif>
	<div class="chart-wrapper-inner">
		<div class="chart-header clearfix">
			@if( !empty($data->logoUrl) )
				<img src="{{ $data->logoUrl }}" class="logo" title="Logo"/>
			@endif
			<h2 class="chart-name"></h2>
			<h3 class="chart-subname"></h3>
			<ul class="chart-tabs clearfix">
				<li class="chart-header-tab header-tab active">
					<a href="#chart-chart-tab" data-toggle="tab" aria-expanded="false">Chart</a>
				</li>
				<li class="data-header-tab header-tab">
					<a href="#data-chart-tab" data-toggle="tab" aria-expanded="false">Data</a>
				</li>
				<li class="map-header-tab header-tab">
					<a href="#map-chart-tab" data-toggle="tab" aria-expanded="false">Map</a>
				</li>
				<li class="sources-header-tab header-tab">
					<a href="#sources-chart-tab" data-toggle="tab" aria-expanded="false">Sources</a>
				</li>
			</ul>
		</div>
		<div class="tab-content">
			<div id="chart-chart-tab" class="tab-pane active">
				<div class="available-countries-select-wrapper">
					<select class="available-countries-select chosen-select" name="available_entities" style="position: relative;z-index: 10;"></select>
				</div>
				<svg xmlns="http://www.w3.org/2000/svg" version="1.1">
					<text x="0" y="20" dy="0" class="h2 chart-name chart-name-svg"></text>
					<text x="0" y="100" dy="0" class="h3 chart-subname chart-subname-svg"></text>
					<text x="0" y="100" dy="0" class="chart-description chart-description-svg"></text>
					<text x="0" y="100" dy="0" class="chart-sources chart-sources-svg"></text>
				</svg>
				<div class="chart-footer clearfix">
					<div class="export-footer-btns">
						<a href="#" class="chart-save-svg-btn" target="_blank">Save to svg</a>
						<a href="#" class="chart-save-png-btn">Save to png</a>
					</div>
					<p class="chart-description"></p>
					<p class="chart-sources"></p>
				</div>
			</div>
			<div id="data-chart-tab" class="tab-pane">
				<a href="#" data-base-url="{!! route( 'dimensions' ) !!}" class="download-data-btn" target="_blank">Download data</a>
				<div class="data-table-wrapper"></div>
			</div>
			<div id="map-chart-tab" class="tab-pane">
				Map tab
			</div>		
			<div id="sources-chart-tab" class="tab-pane">
				Sources tab
			</div>
		</div>
	</div>
</div>