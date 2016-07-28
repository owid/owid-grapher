@extends('app')

@section('content')
	<h2>Sources</h2>
	<a href="{{ route('sources.create') }}" class="btn btn-success btn-new-datasource"><i class="fa fa-plus"></i> Create new source</a>
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