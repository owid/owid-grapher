@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/charts.css') }}" rel="stylesheet" type="text/css">
@endsection
 
@section('content')
	<div style="position:absolute;top:0;left:0;right:0;bottom:0;">
		@include('charts/partials/_chart')
		@include('charts/partials/_form', ['method' => 'post', 'submitLabel' => 'Create chart' ])
	</div>
@endsection

@section('outter-content')
	@include('charts/partials/_select-var-popup')
@endsection

@section('scripts')
	@include('charts/partials/_form-scripts')
	@include('charts/partials/_chart-scripts')
@endsection