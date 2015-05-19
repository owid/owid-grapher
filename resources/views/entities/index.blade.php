@extends('app')

@section('styles')
	{!! Rapyd::styles() !!} 
@endsection

@section('content')
	<h2>Entities</h2>
	{!! $grid !!}
@endsection


@section('scripts')
	{!! Rapyd::scripts() !!} 
@endsection