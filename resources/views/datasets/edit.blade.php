@extends('app')
 
@section('content')
	<div class="module-wrapper edit-dataset-module">
		<a class="back-btn" href="{{ route( 'datasets.show', $dataset->id ) }}"><i class="fa fa-arrow-left"></i>Back to the dataset</a>
		<h2>Edit dataset</h2>
		{!! Form::model($dataset, ['class' => 'validate-form','method' => 'PATCH', 'route' => ['datasets.update', $dataset->id]]) !!}
			<div class="form-group">
				{!! Form::label('name', 'Name:') !!}
				{!! Form::text('name', null, array('class' => 'form-control required')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('description', 'Description:') !!}
				{!! Form::textarea('description', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('fk_dst_cat_id', 'Category') !!}
				{!! Form::select('fk_dst_cat_id', $categories, $dataset->fk_dst_cat_id, array( 'class' => 'form-control' ) ) !!}
			</div>
			<div class="form-group">
				{!! Form::label('fk_dst_subcat_id', 'Subcategory') !!}
				{!! Form::select('fk_dst_subcat_id', $subcategories, $dataset->fk_dst_subcat_id, array( 'class' => 'form-control' ) ) !!}
			</div>
			<div class="form-group">
				{!! Form::submit('Update dataset', ['class'=>'btn btn-success']) !!}
			</div>
	    {!! Form::close() !!}
	</div>
@endsection