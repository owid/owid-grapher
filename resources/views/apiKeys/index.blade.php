@extends('app')

@section('styles')
	{!! Rapyd::styles() !!} 
@endsection

@section('content')
	<h2>API Keys</h2>
	<a href="{!! route('apiKeys.create') !!}" class="btn btn-success">Create new API key</a>
	{!! $grid !!}
@endsection


@section('scripts')
	{!! Rapyd::scripts() !!} 
@endsection