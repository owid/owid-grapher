@extends('app')

@section('content')
	<h2>Datasets</h2>
	<table class="table table-bordered table-hover dataTable">
		<thead>
			<tr>
				<th>Dataset</th>
				<th>Variables</th>
				<th>Last Import</th>
			</tr>
		</thead>
		<tbody>
			@foreach ($datasets as $dataset)
				<tr>
					<td><a href="{{ route('datasets.show', $dataset->id) }}">{{ $dataset->name }}</a></td>
					<td>
						@foreach ($dataset->variables()->get() as $variable)
							<a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a><br>
						@endforeach
					</td>
					<td>
						<?php $variable = $dataset->variables()->first(); ?>
						@if ($variable)
							<time class="timeago" datetime="{{ $variable->uploaded_at }}">{{ $variable->uploaded_at }}</time>
							@if ( $variable->uploaded_by )
								by {{ $variable->uploaded_by }}
							@endif
						@endif
					</td>
				</tr>
			@endforeach
		</tbody>
	</table>
@endsection