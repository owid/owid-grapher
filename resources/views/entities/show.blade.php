@extends('app')

@section('content')
	{!! link_to_route( 'entities.index', 'Back to the list of entities' ) !!}
	<h2>{{ $entity->name }}</h2>
	<h3>{{ $entity->type->name }}</h3>
@endsection