@extends('admin')
 
@section('content')
	<a class="back-btn" href="{{ route( 'apiKeys.show', $apiKey->id ) }}"><i class="fa fa-arrow-left"></i>Back to API key profile</a>
	<h2>Edit {{ $apiKey->name }}</h2>
 	{!! Form::model($apiKey, [ 'class' => 'validate-form edit-form col-sm-12 col-md-6 p0', 'method' => 'PATCH', 'route' => ['apiKeys.update', $apiKey->id]]) !!}
        @include('apiKeys/partials/_form', ['submit_text' => 'Update'])
    {!! Form::close() !!}
@endsection