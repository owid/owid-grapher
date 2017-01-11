@extends('admin')

@section('content')
	<h2>Categories</h2>
	@if ( !$categories->count() )
		There are no categories.
	@else
		<ul>
			@foreach( $categories as $category )
				<li><a href="{{ route('categories.show', $category->id) }}">{{ $category->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection