@extends('view')

@section('content')
	<div class="standalone-chart-viewer" style="position:absolute;top:0;left:0;right:0;bottom:0;">
		@include('charts/partials/_chart')
	</div>
	<!--<div id="chart-view" class="col-sm-12 chart-wrapper chart-show-wrapper" data-chart-id="{{ $chart->id }}">
		<div class="chart-wrapper-inner">
			<h2 class="chart-name"></h2>
			<svg></svg>
			<p class="chart-description"></p>
		</div>
	</div>-->
@endsection

@section('outter-content')
	@include('charts/partials/_export-popup')
@endsection

@section('scripts')
	<script src="{{ elixir('js/ChartApp.js') }}"></script>
@endsection