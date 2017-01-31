<div class="form-group">
	{!! Form::label('name', 'Name:') !!}
	{!! Form::text('name', null, array( 'class' => 'form-control required')) !!}
</div>
<div class="form-group">
	{!! Form::label('displayName', 'Display Name:') !!}
	{!! Form::text('displayName', null, array( 'class' => 'form-control')) !!}
</div>
<div class="form-group">
	<button type="submit" class="btn btn-success">{{ $submit_text }}</button>
</div>