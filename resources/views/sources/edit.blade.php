@extends('app')
 
@section('content')
	<div class="module-wrapper edit-datasource-module">
		<a class="back-btn" href="{{ route( 'sources.show', $source->id ) }}"><i class="fa fa-arrow-left"></i>Back to the source</a>
		<h2>Edit source</h2>
		{!! Form::model($source, ['method' => 'PATCH', 'route' => ['sources.update', $source->id]]) !!}
			<div class="form-group">
				{!! Form::label('name', 'Name:') !!}
				{!! Form::text('name', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('link', 'Link:') !!}
				{!! Form::text('link', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('retrieved', 'Retrieved:') !!}
				{!! Form::text('retrieved', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('description', 'Description:') !!}
				{!! Form::textarea('description', null, array('class' => 'form-control source-editor', 'rows' => 20)) !!}
			</div>
			<div class="form-group">
				{!! Form::submit('Update source', ['class'=>'btn btn-success']) !!}
			</div>
	    {!! Form::close() !!}
	</div>
@endsection