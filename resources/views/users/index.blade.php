@extends('admin')

@section('content')
	<h2>Users</h2>
	<form class="inviteForm form-inline">
		<input type="email" class="form-control" placeholder="Email address" required/>
		<input type="submit" class="btn btn-success" value="Invite user"/>
		<i class="fa fa-spinner fa-spin" style="display: none;"></i>
		<span class="inviteSent" style="display: none;">Invite sent!</span>
	</form>
	@if (!$users->count())
		There are no users.
	@else
		<table class="table table-bordered table-hover dataTable">
			<tr>
				<th>Name</th> 
				<th>Joined</th>
			</tr>
			@foreach ($users as $user)
				<tr>
					<td>{{ $user->name }}</td>
					<td><time class="timeago" datetime="{{ $user->created_at->toIso8601String() }}">{{ $user->created_at }}</time></td>
				</tr>
			@endforeach
		</table>
	@endif
@endsection

@section('scripts')
	<script>
		var $btn = $('.inviteForm .btn-success')
		$('.inviteForm').on('submit', function(ev) {
			ev.preventDefault();
			$('.inviteSent').hide();
			$('.inviteForm .fa-spinner').show();

			$.post(Global.rootUrl + '/users/invite', { email: $('.inviteForm input[type=email]').val() }).done(function() {			
				$('.inviteForm .fa-spinner').hide();
				$('.inviteSent').show();
			})
		})
	</script>
@endsection