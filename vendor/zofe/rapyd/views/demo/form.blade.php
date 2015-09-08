@extends('rapyd::demo.demo')

@section('title','DataForm')

@section('body')

    @include('rapyd::demo.menu_form')

    <h1>DataForm</h1>
    <p>

        {!! $form !!}
        {!! Documenter::showMethod("Zofe\\Rapyd\\Demo\\DemoController", "anyForm") !!}
        {!! Documenter::showCode("zofe/rapyd/views/demo/form.blade.php") !!}
    </p>
@stop
