@extends('app')

@section('content')
	{!! link_to_route( 'entities.index', 'Entities' ) !!}
	<h2>{{ $entity->name }}</h2>
@endsection