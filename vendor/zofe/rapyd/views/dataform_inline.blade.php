
@section('df.header')
    {!! $df->open !!}
    @include('rapyd::toolbar', array('label'=>$df->label, 'buttons_right'=>$df->button_container['TR']))
@show

@if ($df->message != '')
@section('df.message')
    <div class="alert alert-success">{!! $df->message !!}</div>
@show
@endif

@if ($df->message == '')
@section('df.fields')

        @each('rapyd::dataform.field_inline', $df->fields, 'field')

@show
@endif

@section('df.footer')

    @if (isset($df->button_container['BL']) && count($df->button_container['BL']))

        @foreach ($df->button_container['BL'] as $button) {!! $button !!}
        @endforeach

    @endif

    {!! $df->close !!}
@show
