@extends('app')

@section('content')
	{!! link_to_route( 'categories.index', 'Back to the list of categories' ) !!}
	<h2>{{ $category->name }}</h2>
	<ul>
		@foreach( $category->subcategories as $subcategory )
			<li><a href="{{ route('subcategories.edit', $subcategory->id) }}">{{ $subcategory->name }}</a></li>
		@endforeach
	</ul>
@endsection