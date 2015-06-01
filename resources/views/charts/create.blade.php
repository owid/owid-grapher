@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/charts.css') }}" rel="stylesheet" type="text/css">
@endsection
 
@section('content')
	@include('charts/partials/_chart')
	@include('charts/partials/_form', ['method' => 'post'])
@endsection

@section('outter-content')
	@include('charts/partials/_select-var-popup')
@endsection

@section('scripts')
	@include('charts/partials/_form-scripts')
	@include('charts/partials/_chart-scripts')
@endsection