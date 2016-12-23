@extends('app')
 
@section('content')
	@include('charts/partials/_form', ['method' => 'post', 'submitLabel' => 'Save draft' ])
@endsection

@section('outter-content')
	@include('charts/partials/_select-var-popup')
	@include('charts/partials/_settings-var-popup')
	@include('charts/partials/_export-popup')
@endsection

@section('scripts')
@endsection