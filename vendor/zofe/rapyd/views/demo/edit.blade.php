@extends('rapyd::demo.demo')

@section('title','DataEdit')

@section('body')

    <h1>DataEdit</h1>
    <p>

        {!! $edit !!}
        {!! Documenter::showMethod("Zofe\\Rapyd\\Demo\\DemoController", "anyEdit") !!}
        {!! Documenter::showCode("zofe/rapyd/views/demo/edit.blade.php") !!}
    </p>
@stop
