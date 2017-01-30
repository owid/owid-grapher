@extends('admin')

@section('content')
	<a class="back-btn" href="{{ route( 'categories.index' ) }}"><i class="fa fa-arrow-left"></i>Back to the list of categories</a>
	<div class="pull-right">
		<a class="" href="{{ route( 'categories.edit', $category->id ) }}"><i class="fa fa-pencil"></i>Edit category</a>
	</div>
	<h2>{{ $category->name }}</h2>
	<h3>Subcategories</h3>
	<ul class="no-bullets p0">
		@foreach( $category->subcategories as $subcategory )
			<li><a href="{{ route('subcategories.edit', $subcategory->id) }}">{{ $subcategory->name }}</a></li>
		@endforeach
	</ul>
	<a class="new-subcategory-btn" href="{{ route( 'subcategories.create' ) }}"><i class="fa fa-plus"></i>Create new subcategory</a>
@endsection