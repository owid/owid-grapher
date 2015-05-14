@extends('app')

@section('content')
	<h2>Entities</h2>
	@if ( !$entities->count() )
		There are no entities.
	@else
		<ul>
			@foreach( $entities as $entity )
				<li><a href="{{ route('entities.show', $entity->id) }}">{{ $entity->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection