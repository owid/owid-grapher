@extends('app')
 
@section('content')
	{!! link_to_route( 'entities.index', 'Back to the list of entities' ) !!}
	<h2>Edit {{ $entity->name }}</h2>
 	{!! Form::model($entity, ['method' => 'PATCH', 'route' => ['entities.update', $entity->id]]) !!}
        @include('entities/partials/_form', ['submit_text' => 'Update Entity'])
    {!! Form::close() !!}
@endsection