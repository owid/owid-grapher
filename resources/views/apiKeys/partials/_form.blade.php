<div class="form-group">
	{!! Form::label('name', 'Name:') !!}
	{!! Form::text('name', null, array( 'class' => 'form-control required')) !!}
</div>
<div class="form-group">
	{!! Form::label('value', 'Value:') !!}
	{!! Form::text('value', null, array( 'class' => 'form-control required')) !!}
</div>
<div class="form-group">
	<button type="submit" class="btn btn-success">{{ $submit_text }}</button>
</div>