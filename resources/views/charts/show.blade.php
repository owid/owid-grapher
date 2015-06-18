@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/charts.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	<div class="chart-show-module" style="position:absolute;top:0;left:0;right:0;bottom:0;">
		@include('charts/partials/_chart')
	</div>
@endsection

@section('scripts')
	@include('charts/partials/_chart-scripts')
@endsection