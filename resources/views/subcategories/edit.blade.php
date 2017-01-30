@extends('admin')

@section('content')
	<a class="back-btn" href="{{ route( 'categories.show', $subcategory->fk_dst_cat_id ) }}"><i class="fa fa-arrow-left"></i>Back to the category</a>
	<div class="pull-right">
		{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('subcategories.destroy', $subcategory->id))) !!}
			{!! Form::submit('Delete subcategory', array('class' => 'btn btn-danger')) !!}
		{!! Form::close() !!}
	</div>
	<h2>Edit subcategory</h2>
	@include('subcategories/partials/_form', ['method' => 'PATCH', 'route' => ['subcategories.update', $subcategory->id], 'submitLabel' => 'Update subcategory'])
@endsection
