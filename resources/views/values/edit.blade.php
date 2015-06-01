@extends('app')
 
@section('content')
	<div class="module-wrapper edit-value-module">
		<a class="back-btn" href="{{ route( 'variables.show', $dataValue->fk_var_id ) }}"><i class="fa fa-arrow-left"></i>Back to the variable</a>
		<h2>Edit value</h2>
		<div class="pull-right">
			{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('values.destroy', $dataValue->id))) !!}
				{!! Form::submit('Delete value', array('class' => 'btn btn-danger')) !!}
			{!! Form::close() !!}
		</div>
		{!! Form::model($dataValue, ['method' => 'PATCH', 'route' => ['values.update', $dataValue->id]]) !!}
			<div class="form-group">
				{!! Form::label('value', 'Value:') !!}
				{!! Form::text('value', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('description', 'Description:') !!}
				{!! Form::textarea('description', null, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('time-label', 'Time Label:') !!}
				{!! Form::text('time-label', $dataValue->time->label, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::label('fk_ent_id', 'Entity:') !!}
				{!! Form::select('fk_ent_id', $entities, $dataValue->entity->id, array('class' => 'form-control')) !!}
			</div>
			<div class="form-group">
				{!! Form::submit('Update value', ['class'=>'btn btn-success']) !!}
			</div>
		{!! Form::close() !!}
	</div>
@endsection