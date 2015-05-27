@extends('app')

@section('content')
	<h2>Edit subcategory</h2>
	@include('subcategories/partials/_form', ['method' => 'put'])
@endsection
