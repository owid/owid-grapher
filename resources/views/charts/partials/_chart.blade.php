<div id="chart" @if (isset($chart)) data-chart-id="{{ $chart->id }}" @endif>	
	<div class="chart-inner" style="visibility: hidden;">
		<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"></svg>

		<div class="html-overlay">
			<nav class="tabs">
				<ul>
					<li class="header-tab" data-tab='chart'>
						<a href="#chart-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-line-chart"></i>Chart</a>
					</li>
					<li class="header-tab" data-tab='data'>
						<a href="#data-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-table"></i>Data</a>
					</li>
					<li class="header-tab" data-tab='map'>
						<a href="#map-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-map"></i>Map</a>
					</li>
					<li class="header-tab" data-tab='sources'>
						<a href="#sources-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-link"></i>Sources</a>
					</li>
					@if (isset($chart))
						<li class="edit-btn-wrapper hidden">
							<a href="{{ Request::root() }}/charts/{{ $chart->id }}/edit" class="edit-btn" target="_blank" title="Edit chart"><i class="fa fa-pencil"></i></a>
						</li>
					@endif
				</ul>
			</nav>

			<div class="tab-content">
				<div id="chart-chart-tab" class="tab-pane">
					<div class="available-countries-select-wrapper">
						<select class="available-countries-select chosen-select" name="available_entities" style="position: relative;z-index: 10;"></select>
					</div>
					<div class="axis-scale-selectors-wrapper">
						<div class="x-axis-scale-selector">
							<a class="axis-scale-btn clickable">
								<i class="fa fa-cog"></i>
								<span>Linear</span>
							</a>
						</div>
						<div class="y-axis-scale-selector">
							<a class="axis-scale-btn clickable">
								<i class="fa fa-cog"></i>
								<span>Linear</span>
							</a>
						</div>
					</div>
				</div>
				<div id="data-chart-tab" class="tab-pane">
					<a href="#" class="btn btn-success download-data-btn" target="_blank" title="Export CSV for this data"><i class="fa fa-download"></i>CSV</a>
					<a href="#" class="btn btn-primary download-full-btn" target="_blank" title="Export CSV for all available countries"><i class="fa fa-download"></i>CSV (all available countries)</a>
					<table class="data-table"></table>
				</div>
				<div id="map-chart-tab" class="tab-pane">
					<div class="map-controls-header">
						<!--<div class="target-year-control control">
							<div class="control-head">
								<i class="fa fa-clock-o"></i>
								<label class="target-year-label"></label>
							</div>
							<div class="control-body">
								<input type="range" min="1950" max="2010" step="10"  />
							</div>
						</div>-->
						<div class="region-control control">
							<div class="control-head">
								<i class="fa fa-map"></i>
								<label class="region-label">World</label>
							</div>
							<div class="control-body">
								<ul>
									<li class="World-projection">World</li>
									<li class="Africa-projection">Africa</li>
									<li class="N.America-projection">N.America</li>
									<li class="S.America-projection">S.America</li>
									<li class="Asia-projection">Asia</li>
									<li class="Australia-projection">Australia</li>
									<li class="Europe-projection">Europe</li>
								</ul>
							</div>
						</div>
						<div class="settings-control control">
							<div class="control-head">
								<i class="fa fa-cog"></i>
							</div>
							<div class="control-body">
								<label>
									<input type="checkbox" name="interpolate-data" checked/>
									Interpolate data between years
								</label>
							</div>
						</div>
						<div class="color-blind-control control" title="Colorblind safe color scheme">
							<div class="control-head">
								<i class="fa fa-eye"></i>
							</div>
						</div>
					</div>
				</div>		
				<div id="sources-chart-tab" class="tab-pane"></div>
			</div>
			
			<div class="footer-btns">
				<a class="chart-link-btn" target="_blank">
					<i class="fa fa-link"></i>
					<span>Link</span>
				</a>
				<a class="tweet-btn" target="_blank">
					<i class="fa fa-twitter"></i>
					<span>Tweet</span>
				</a>
				<a class="facebook-btn" target="_blank">
					<i class="fa fa-facebook"></i>
					<span>Share</span>
				</a>
				<a class="embed-btn">
					<i class="fa fa-code"></i>
					<span>Embed</span>
				</a>
				<a class="download-image-btn" target="_blank">
					<i class="fa fa-download"></i>
					<span>PNG</span>
				</a>
				<a class="download-svg-btn" target="_blank">
					<i class="fa fa-download"></i>
					<span>SVG</span>
				</a>
			</div>
		</div>
	</div>

	<div class="chart-preloader">
		<i class="fa fa-spinner fa-spin"></i>
	</div>
</div>