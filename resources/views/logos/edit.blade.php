@extends('admin')
 
@section('content')
	<div class="module-wrapper edit-logo-module">
		<a class="back-btn" href="{{ route( 'logos.show', $logo->id ) }}"><i class="fa fa-arrow-left"></i>Back to the logo</a>
		<h2>Edit logo</h2>
		{!! Form::model($logo, ['method' => 'PATCH', 'route' => ['logos.update', $logo->id], 'files'=>true]) !!}
			<div class="form-group">
				{!! Form::label('name', 'Name:') !!}
				{!! Form::text('name', null, array('class' => 'form-control')) !!}
			</div>
			{!! Form::file('image') !!}
			<div class="form-group">
				{!! Form::submit('Update logo', ['class'=>'btn btn-success']) !!}
			</div>
	    {!! Form::close() !!}
	</div>
@endsection