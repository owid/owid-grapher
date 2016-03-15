@extends('app')

@section('content')
	<h2>Datasets</h2>
	<table class="table table-bordered table-hover dataTable">
		<thead>
			<tr>
				<th>Variable</th>
				<th>Dataset</th>
				<th>Source</th>
				<th>Uploaded</th>
			</tr>
		</thead>
		<tbody>
			@foreach ($variables as $variable)
			<tr>
				<!--<td><a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a></td>-->
				<td>{{ $variable->name }}</td>				
				<td><a href="{{ route('datasets.show', $variable->dataset_id) }}">{{ $variable->dataset_name }}</a></td>
				<td><a href="{{ route('datasources.show', $variable->source_id) }}">{{ $variable->source_name }}</a></td>
				<td>
					<time class="timeago" datetime="{{ $variable->uploaded_at }}">{{ $variable->uploaded_at }}</time>
					@if ( $variable->uploaded_by )
						by {{ $variable->uploaded_by }}
					@endif
				</td>
			</tr>
			@endforeach
		</tbody>
	</table>
@endsection