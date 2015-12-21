@extends('app')
 
@section('content')
	<div class="module-wrapper edit-datasource-module">
		<a class="back-btn" href="{{ route( 'datasources.index' ) }}"><i class="fa fa-arrow-left"></i>Back to logos</a>
		<h2>Create new logo</h2>
		{!! Form::open(['method' => 'POST', 'route' => ['logos.store'], 'files'=>true]) !!}
			<div class="form-group">
				{!! Form::label('name', 'Name:') !!}
				{!! Form::text('name', null, array('class' => 'form-control')) !!}
			</div>
			{!! Form::file('image') !!}
			{!! Form::submit('Submit', array('class'=>'btn btn-success form-control')) !!}
		{!! Form::close() !!}
	</div>
@endsection