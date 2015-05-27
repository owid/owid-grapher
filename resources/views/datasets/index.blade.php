@extends('app')

@section('content')
	<h2>Datasets</h2>
	@if ( !$datasets->count() )
		There are no datasets.
	@else
		<ul>
			@foreach( $datasets as $dataset )
				<li><a href="{{ route('datasets.show', $dataset->id) }}">{{ $dataset->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection