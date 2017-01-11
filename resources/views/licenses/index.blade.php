@extends('admin')

@section('content')
	<h2>Licenses</h2>
	@if ( !$licenses->count() )
		There are no sources.
	@else
		<ul>
			@foreach( $licenses as $license )
				<li><a href="{{ route('licenses.show', $license->id) }}">{{ $license->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection