<div id="chart-view" class="col-sm-12 col-md-6 chart-wrapper chart-edit-wrapper" @if (isset($chart)) data-chart-id="{{ $chart->id }}" @endif>
	<div class="chart-wrapper-inner">
		<div class="chart-header">
			<a href="#" class="chart-save-png-btn">Save to png</a>
			<h2 class="chart-name"></h2>
			<ul>
				<li class="chart-header-tab header-tab active">
					<a href="#chart-tab" data-toggle="tab" aria-expanded="false">Chart</a>
				</li>
				<li class="data-header-tab header-tab">
					<a href="#data-tab" data-toggle="tab" aria-expanded="false">Data</a>
				</li>
				<li class="map-header-tab header-tab">
					<a href="#map-tab" data-toggle="tab" aria-expanded="false">Map</a>
				</li>
				<li class="sources-header-tab header-tab">
					<a href="#sources-tab" data-toggle="tab" aria-expanded="false">Sources</a>
				</li>
			</ul>
		</div>
		<div class="tab-content">
			<div id="chart-tab" class="tab-pane active">
				<svg></svg>
				<p class="chart-description"></p>
			</div>
			<div id="data-tab" class="tab-pane">
				Data tab
			</div>
			<div id="map-tab" class="tab-pane">
				Map tab
			</div>		
			<div id="sources-tab" class="tab-pane">
				Sources tab
			</div>
		</div>
	</div>
</div>