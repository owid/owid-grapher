@extends('admin')
 
@section('content')
	<div class="module-wrapper edit-license-module">
		<a class="back-btn" href="{{ route( 'licenses.show', $license->id ) }}"><i class="fa fa-arrow-left"></i>Back to the license</a>
		<h2>Edit license</h2>
		{!! Form::model($license, ['class' => 'validate-form', 'method' => 'PATCH', 'route' => ['licenses.update', $license->id]]) !!}
			<div class="form-group">
				{!! Form::label('name', 'Name:') !!}
				{!! Form::text('name', null, array('class' => 'form-control required')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('description', 'Description:') !!}
				{!! Form::textarea('description', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::submit('Update source', ['class'=>'btn btn-success']) !!}
			</div>
	    {!! Form::close() !!}
	</div>
@endsection