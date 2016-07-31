@extends('app')

@section('content')
	<h2>Sources</h2>
	@if ( !$sources->count() )
		There are no sources.
	@else
		<ul>
			@foreach( $sources as $source )
				<li><a href="{{ route('sources.show', $source->id) }}">{{ $source->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection