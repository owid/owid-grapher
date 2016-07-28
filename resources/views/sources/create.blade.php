@extends('app')
 
@section('content')
	<div class="module-wrapper edit-datasource-module">
		<a class="back-btn" href="{{ route( 'sources.index' ) }}"><i class="fa fa-arrow-left"></i>Back to sources</a>
		<h2>Create new source</h2>
		{!! Form::open(['method' => 'POST', 'route' => ['sources.store']]) !!}
			<div class="form-group">
				{!! Form::label('name', 'Name:') !!}
				{!! Form::text('name', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('description', 'Description:') !!}
				{!! Form::textarea('description', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('link', 'Link:') !!}
				{!! Form::text('link', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::submit('Create source', ['class'=>'btn btn-success']) !!}
			</div>
	    {!! Form::close() !!}
	</div>
@endsection