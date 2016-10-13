@extends('view')

@section('content')
	@include('charts/partials/_chart')
@endsection

@section('outter-content')
	@include('charts/partials/_embed-modal')
@endsection

@section('scripts')
	<script src="/grapher/config/{!! $chart->id !!}.js"></script>
@endsection