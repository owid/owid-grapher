@extends('admin')

@section('content')
	{!! link_to_route( 'apiKeys.index', 'Back to the list of API keys' ) !!}
	<div class="pull-right">
		<a class="edit-btn" href="{{ route( 'apiKeys.edit', $apiKey->id ) }} "><i class="fa fa-pencil"></i>Edit</a>
		{!! Form::open(array('route' => array('apiKeys.destroy', $apiKey->id), 'method' => 'delete')) !!}
			<button type="submit" class="" style="background-color:transparent;color:red;border:0;"><i class="fa fa-times"></i>Delete</button>
		{!! Form::close() !!}
	</div>
	<h2>{{ $apiKey->name }}</h2>
	<h3>{{ $apiKey->value }}</h3>
@endsection