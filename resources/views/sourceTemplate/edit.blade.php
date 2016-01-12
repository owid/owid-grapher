@extends('app')
 
@section('content')
	<div class="module-wrapper edit-sources-template-module">
		<h2>Edit source template</h2>
		{!! Form::model($sourceTemplate, ['method' => 'PATCH', 'route' => ['sourceTemplate.update'] ]) !!}
			<div class="form-group">
				{!! Form::label('source_template', 'Source template:') !!}
				{!! Form::textarea('source_template', $sourceTemplate->meta_value, array('class' => 'form-control datasource-editor required')) !!}
			</div>
			<div class="form-group">
				{!! Form::submit('Update sources template', ['class'=>'btn btn-success']) !!}
			</div>
	    {!! Form::close() !!}
	</div>
@endsection