

<div class="btn-toolbar" role="toolbar">

    @if (isset($label))
    <div class="pull-left">
        <h2>{!! $label !!}</h2>
    </div>
    @endif
    @if (isset($buttons_left) && count($buttons_left))
    <div class="pull-left">
        @foreach ($buttons_left as $button) {!! $button !!}
        @endforeach
    </div>
    @endif
    @if (isset($buttons_right) && count($buttons_right))
    <div class="pull-right">
        @foreach ($buttons_right as $button) {!! $button !!}
        @endforeach
    </div>
    @endif
</div>
 <br />
