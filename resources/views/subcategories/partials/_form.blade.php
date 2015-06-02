{!! Form::model( $subcategory, array( 'method' => $method, 'route' => ['subcategories.update', $subcategory->id], 'class' => 'col-sm-12 col-md-6 p0' ) ) !!}
	<div class="form-group">
		{!! Form::label('name', 'Name:') !!}
		{!! Form::text('name', null, array('class' => 'form-control', 'required' => 'required' ) ) !!}
	</div>
	<div class="form-group">
		{!! Form::submit('Update subcategory', ['class'=>'btn btn-success']) !!}
	</div>
{!! Form::close() !!}