@extends('view')

@section('content')
	<div style="display: flex; height: 100%; align-items: center; justify-content: center;">
		<form action="{{ route('signupSubmit') }}" method="post">
		    {{ csrf_field() }}		
			<input name="code" type="hidden" value="{{ $invitation->code }}">
			<h1>owid-grapher signup for {{ $invitation->email }}</h1>
			<div class="form-group">
				<input name="name" type="text" placeholder="Name" class="form-control" aria-label="Name" required>
			</div>
			<div class="form-group">
				<input name="password" type="password" pattern=".{3,}" class="form-control" placeholder="Password" aria-label="Password" required>
			</div>
			<input type="submit" class="btn btn-primary" value="Sign up" style="width: 100%;">
			@if (count($errors) > 0)
			    <div class="alert alert-danger" style="margin-top: 20px;">
			        <ul>
			            @foreach ($errors->all() as $error)
			                <li>{{ $error }}</li>
			            @endforeach
			        </ul>
			    </div>
			@endif
		</form>
	</div>
@endsection

