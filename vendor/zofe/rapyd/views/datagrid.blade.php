

@include('rapyd::toolbar', array('label'=>$label, 'buttons_right'=>$buttons['TR']))


<table{!! $dg->buildAttributes() !!}>
    <thead>
    <tr>
     @foreach ($dg->columns as $column)
            <th{!! $column->buildAttributes() !!}>
            @if ($column->orderby)
                @if ($dg->onOrderby($column->orderby_field, 'asc'))
                    <span class="glyphicon glyphicon-arrow-up"></span>
                @else
                    <a href="{!! $dg->orderbyLink($column->orderby_field,'asc') !!}">
                        <span class="glyphicon glyphicon-arrow-up"></span>
                    </a>
                @endif
                @if ($dg->onOrderby($column->orderby_field, 'desc'))
                    <span class="glyphicon glyphicon-arrow-down"></span>
                @else
                    <a href="{!! $dg->orderbyLink($column->orderby_field,'desc') !!}">
                        <span class="glyphicon glyphicon-arrow-down"></span>
                    </a>
                @endif
             @endif
                {!! $column->label !!}
            </th>
     @endforeach
    </tr>
    </thead>
    <tbody>
    @foreach ($dg->rows as $row)
        <tr{!! $row->buildAttributes() !!}>
            @foreach ($row->cells as $cell)
            <td{!! $cell->buildAttributes() !!}>{!! $cell->value !!}</td>
            @endforeach
        </tr>
    @endforeach
    </tbody>
</table>


@if ($dg->havePagination())
    <div class="pagination">
    {!! $dg->links() !!}
    </div>
@endif
