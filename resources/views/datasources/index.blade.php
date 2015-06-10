@extends('app')

@section('content')
	<h2>Sources</h2>
	<a href="{{ route('datasources.create') }}" class="btn btn-success btn-new-datasource"><i class="fa fa-plus"></i> Create new source</a>
	@if ( !$datasources->count() )
		There are no sources.
	@else
		<ul>
			@foreach( $datasources as $datasource )
				<li><a href="{{ route('datasources.show', $datasource->id) }}">{{ $datasource->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection