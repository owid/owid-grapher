@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/charts.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	@include('charts/partials/_chart')
@endsection

@section('scripts')
	@include('charts/partials/_chart-scripts')
@endsection