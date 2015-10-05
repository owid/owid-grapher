@extends('app')
 
@section('content')
	<div style="position:absolute;top:0;left:0;right:0;bottom:0;">
		@include('charts/partials/_chart')
		@include('charts/partials/_form', ['method' => 'put', 'submitLabel' => 'Update chart'])
	</div>
@endsection

@section('outter-content')
	@include('charts/partials/_select-var-popup')
	@include('charts/partials/_settings-var-popup')
@endsection

@section('scripts')
	<script src="{{ asset('js/FormApp.js') }}?bust={!!time()!!}"></script>
@endsection