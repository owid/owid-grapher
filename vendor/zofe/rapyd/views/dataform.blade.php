
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

        @each('rapyd::dataform.field', $df->fields, 'field')

@show
@endif

@section('df.footer')
    @include('rapyd::toolbar', array('buttons_left'=>$df->button_container['BL'], 'buttons_right'=>$df->button_container['BR'] ))
    {!! $df->close !!}
@show
