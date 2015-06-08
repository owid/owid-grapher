<div id="chart-view" class="col-sm-12 col-md-6 chart-wrapper chart-edit-wrapper" @if (isset($chart)) data-chart-id="{{ $chart->id }}" @endif>
	<div class="chart-wrapper-inner">
		<div class="chart-header clearfix">
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
				<svg></svg>
				<div class="chart-footer clearfix">
					<a href="#" class="chart-save-png-btn pull-right">Save to png</a>
					<p class="chart-description"></p>
				</div>
			</div>
			<div id="data-chart-tab" class="tab-pane">
				Data tab
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