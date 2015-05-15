@extends('app')
 
@section('content')
	<div id="chart-view" class="col-sm-12 col-md-6 chart-wrapper chart-edit-wrapper" data-chart-id="{{ $chart->id }}">
		<div class="chart-wrapper-inner">
			<h2 class="chart-name"></h2>
			<svg></svg>
			<p class="chart-description"></p>
		</div>
	</div>
	@include('charts/partials/_form', ['method' => 'put'])
@endsection

@section('scripts')
	@include('charts/partials/_form-scripts')
@endsection