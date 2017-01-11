@extends('admin')

@section('content')
	<h2>Tags</h2>
	@if ( !$tags->count() )
		There are no tags.
	@else
		<ul>
			@foreach( $tags as $tag )
				<li>{{ $tag->name }}</li>
			@endforeach
		</ul>
	@endif
@endsection