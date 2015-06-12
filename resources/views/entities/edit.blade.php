@extends('app')
 
@section('content')
	<a class="back-btn" href="{{ route( 'entities.index' ) }}"><i class="fa fa-arrow-left"></i>Back to the list of entities</a>
	<h2>Edit {{ $entity->name }}</h2>
 	{!! Form::model($entity, [ 'class' => 'validate-form', 'method' => 'PATCH', 'route' => ['entities.update', $entity->id]]) !!}
        @include('entities/partials/_form', ['submit_text' => 'Update Entity'])
    {!! Form::close() !!}
@endsection