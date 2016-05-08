<div id="chart-view" class="col-sm-12 col-md-6 chart-wrapper chart-edit-wrapper" @if (isset($chart)) data-chart-id="{{ $chart->id }}" @endif>
	<div class="chart-wrapper-inner">
		<div class="chart-header clearfix">
			<div class="logos">
				<img src="" class="second-logo" title="Logo" style="display: none;"/>
				<a target="_blank" href="https://ourworldindata.org">
					<img src="" class="logo" title="Logo" style="visibility:hidden"/>
				</a>
			</div>
			<h2 class="chart-name"></h2>
			<h3 class="chart-subname"></h3>
			<ul class="chart-tabs clearfix">
				<li class="chart-header-tab header-tab">
					<a href="#chart-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-line-chart"></i>Chart</a>
				</li>
				<li class="data-header-tab header-tab">
					<a href="#data-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-table"></i>Data</a>
				</li>
				<li class="map-header-tab header-tab">
					<a href="#map-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-map"></i>Map</a>
				</li>
				<li class="sources-header-tab header-tab">
					<a href="#sources-chart-tab" data-toggle="tab" aria-expanded="false"><i class="fa fa-link"></i>Sources</a>
				</li>
				<li class="reload-btn-wrapper">
					<a href="#" class="reload-btn" title="Reload chart"><i class="fa fa-refresh"></i></a>
				</li>
				@if (Auth::user() && isset($chart))
					<li class="edit-btn-wrapper">
						<a href="{{ Request::root() }}/charts/{{ $chart->id }}/edit" class="edit-btn" target="_blank" title="Edit chart"><i class="fa fa-pencil"></i></a>
					</li>
				@endif
			</ul>
		</div>
		<div class="tab-content">
			<div id="chart-chart-tab" class="tab-pane">
				<div class="available-countries-select-wrapper">
					<select class="available-countries-select chosen-select" name="available_entities" style="position: relative;z-index: 10;"></select>
				</div>
				<svg xmlns="http://www.w3.org/2000/svg" class="nvd3-svg"  version="1.1"></svg>
				<div class="axis-scale-selectors-wrapper">
					<div class="x-axis-scale-selector">
						<a class="axis-scale-btn" style="cursor: pointer;">
							<i class="fa fa-cog"></i>
							<span>Linear</span>
						</a>
					</div>
					<div class="y-axis-scale-selector">
						<a class="axis-scale-btn" style="cursor: pointer;">
							<i class="fa fa-cog"></i>
							<span>Linear</span>
						</a>
					</div>
				</div>
			</div>
			<div id="data-chart-tab" class="tab-pane">
				<a href="#" data-base-url="{!! isset($chart) ? Request::root() . '/' . $chart->slug . '.csv' : '' !!}" class="btn btn-primary download-data-btn" target="_blank"><i class="fa fa-download"></i>Download data</a>
				<div class="data-table-wrapper"></div>
			</div>
			<div id="map-chart-tab" class="tab-pane">
				<div class="map-controls-header clearfix">
					<!--<div class="target-year-control control clearfix">
						<div class="control-head">
							<i class="fa fa-clock-o"></i>
							<label class="target-year-label"></label>
						</div>
						<div class="control-body">
							<input type="range" min="1950" max="2010" step="10"  />
						</div>
					</div>-->
					<div class="region-control control clearfix">
						<div class="control-head">
							<i class="fa fa-map"></i>
							<label class="region-label">World</label>
						</div>
						<div class="control-body">
							<ul class="clearfix">
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
					<div class="settings-control control clearfix">
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
					<div class="color-blind-control control clearfix" title="Colorblind safe color scheme">
						<div class="control-head">
							<i class="fa fa-eye"></i>
						</div>
					</div>
				</div>
				<div class="map-timeline-controls clearfix">
					<div class="play-pause-control control">
						<a href="#" class="play-btn btn"><i class="fa fa-play-circle-o"></i></a>
						<a href="#" class="pause-btn btn">
							<span class="fa-stack fa">
								<i class="fa fa-circle-o fa-stack-2x"></i>
								<i class="fa fa-pause fa-stack-1x"></i>
							</span>
						</a>
					</div>
					<div class="timeline-control control">
						<div class="timeline-wrapper">
							<div class="timeline-start-year">1950</div>
							<div class="timeline-end-year">2000</div>
							<div class="timeline-slider">
								<span class="timeline-slider-label">1980</span>
							</div>
							<input list="timeline-range" type="range" min="1950" max="2010" step="1" />
						</div>
					</div>
					<div class="buttons-control control">
						<ul class="buttons-wrapper">
						</ul>
					</div>
				</div>
			</div>		
			<div id="sources-chart-tab" class="tab-pane"></div>
		</div>
		@include('charts/partials/_chart-footer')
	</div>
	<div class="chart-preloader">
		<i class="fa fa-spinner fa-spin"></i>
	</div>
	<div class="chart-error">
		<p><i class="fa fa-exclamation-triangle"></i>Error retrieving data for chart builder!</p>
	</div>
</div>