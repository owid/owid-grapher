@extends('admin')

@section('content')
	<a class="back-btn" href="{{ route( 'categories.index' ) }}"><i class="fa fa-arrow-left"></i>Back to the list of categories</a>
	<div class="pull-right">
		{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('categories.destroy', $category->id))) !!}
			{!! Form::submit('Delete category', array('class' => 'btn btn-danger')) !!}
		{!! Form::close() !!}
	</div>
	<h2>Edit category</h2>
	@include('categories/partials/_form', ['method' => 'PATCH', 'submitLabel' => 'Edit category', 'route' => ['categories.update', $category->id ] ])
@endsection