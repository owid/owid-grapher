@extends('app')

@section('content')
	<a class="back-btn" href="{{ route( 'categories.index' ) }}"><i class="fa fa-arrow-left"></i>Back to the list of categories</a>
	<h2>New subcategory</h2>
	@include('subcategories/partials/_form', ['method' => 'POST', 'submitLabel' => 'Create category', 'route' => ['subcategories.store'] ])
@endsection
