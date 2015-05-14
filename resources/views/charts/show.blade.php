@extends('app')

@section('content')
	<div id="chart-view" class="col-sm-12 chart-wrapper chart-show-wrapper" data-chart-id="{{ $chart->id }}">
		<div class="chart-wrapper-inner">
			<h2 class="chart-name"></h2>
			<svg></svg>
			<p class="chart-description"></p>
		</div>
	</div>
@endsection

@section('scripts')
	<script src="{{ asset('js/app/views/App.Views.ChartView.js') }}"></script>
@endsection