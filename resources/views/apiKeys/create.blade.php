@extends('admin')
 
@section('content')
	{!! link_to_route( 'apiKeys.index', 'Back to the list of API keys' ) !!}
	<h2>New API key</h2>
	{!! Form::open( [ 'class' => 'validate-form create-form col-sm-12 col-md-6 p0', 'method' => 'POST', 'route' => ['apiKeys.store'] ] ) !!}
        @include( 'apiKeys/partials/_form', ['submit_text' => 'Create', 'value' => $randomKey ] )
    {!! Form::close() !!}
@endsection