@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/charts.css') }}" rel="stylesheet" type="text/css">
@endsection
 
@section('content')
	<div id="chart-view" class="col-sm-12 col-md-6 chart-wrapper">
		<div class="chart-wrapper-inner">
			<h2 class="chart-name"></h2>
			<svg></svg>
			<p class="chart-description"></p>
		</div>
	</div>
	@include('charts/partials/_form', ['method' => 'post'])
@endsection

@section('outter-content')
	@include('charts/partials/_select-var-popup')
@endsection

@section('scripts')
	@include('charts/partials/_form-scripts')
@endsection