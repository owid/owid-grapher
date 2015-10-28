<?php

namespace Zofe\Rapyd\DataEdit;

use Zofe\Rapyd\DataForm\DataForm;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Config;
use Zofe\Rapyd\Persistence;

class DataEdit extends DataForm
{

    //flow
    protected $postprocess_url = "";
    protected $undo_url = "";
    public $back_url = "";
    public $back_on = array();
    public $buttons = array();

    public function __construct()
    {
        parent::__construct();
        $this->process_url = '';
    }

    /**
     * detect dataedit status by qs,
     * if needed it find the record for show/modify/delete "status"
     */
    protected function sniffStatus()
    {
        $this->status = "idle";
        ///// show /////
        if ($this->url->value('show' . $this->cid)) {
            $this->status = "show";
            $this->process_url = "";
            if (!$this->find($this->url->value('show' . $this->cid))) {
                $this->status = "unknow_record";
            }
            ///// modify /////
        } elseif ($this->url->value('modify' . $this->cid.'|update' . $this->cid)) {
            $this->status = "modify";
            $this->method = "patch";
            $this->process_url = $this->url->replace('modify' . $this->cid, 'update' . $this->cid)->get();
            if (!$this->find($this->url->value('modify' . $this->cid.'|update'. $this->cid))) {
                $this->status = "unknow_record";
            }
            ///// create /////
        } elseif ($this->url->value('show' . $this->cid . "|modify" . $this->cid . "|create" . $this->cid . "|delete" . $this->cid) === false) {
            $this->status = "create";
            $this->method = "post";
            $this->process_url = $this->url->append('insert' . $this->cid, 1)->get();
        } elseif ($this->url->value('create' . $this->cid)) {
            $this->status = "create";
            $this->method = "post";
            $this->process_url = $this->url->replace('create' . $this->cid, 'insert' . $this->cid)->get();
            ///// delete /////
        } elseif ($this->url->value('delete' . $this->cid)) {
            $this->status = "delete";
            $this->method = "delete";
            $this->process_url = $this->url->replace('delete' . $this->cid, 'do_delete' . $this->cid)->get();
            $this->undo_url = $this->url->replace('delete' . $this->cid, 'show' . $this->cid)->get();
            if (!$this->find($this->url->value('delete' . $this->cid))) {
                $this->status = "unknow_record";
            }
        } else {
            $this->status = "unknow_record";
        }
    }

    /**
     * find a record on current model, and return bool
     * @param $id
     * @return bool
     */
    protected function find($id)
    {
        $model = $this->model;
        $this->model = $model::find($id);
        if (!$this->model) {
            // belts and braces check - no model = doesn't exist (without being masked missing object property)
            // potential candidate for custom exception handling
            return false;
        }
        return $this->model->exists;
    }

    /**
     * detect current action to execute by request method and qs
     * if needed it find the record for update/do_delete "action"
     */
    protected function sniffAction()
    {

        ///// insert /////
        if (Request::isMethod('post') && $this->url->value('insert' . $this->cid)) {
            $this->action = "insert";
            ///// update /////
        } elseif (Request::isMethod('patch') && $this->url->value('update' . $this->cid)) {
            $this->action = "update";
            $this->process_url = $this->url->append('update', $this->url->value('update' . $this->cid))->get();
            if (!$this->find($this->url->value('update' . $this->cid))) {
                $this->status = "unknow_record";
            }
            ///// delete /////
        } elseif (Request::isMethod('delete') && $this->url->value("do_delete" . $this->cid)) {
            $this->action = "delete";
            if (!$this->find($this->url->value("do_delete" . $this->cid))) {
                $this->status = "unknow_record";
            }
        }
    }

    /**
     * process works with current action/status, appended fields and model
     * it do field validation, field auto-update, then model operations
     * in can change current status and setup an output message
     * @return bool|void
     */
    protected function process()
    {
        $result = parent::process();
        switch ($this->action) {
            case "update":

                if ($this->on("error")) {
                    $this->status = "modify";
                }
                if ($this->on("success")) {
                    $this->status = "modify";
                    if (in_array('update',$this->back_on)) {
                        $this->redirect = $this->back_url;
                    } else {
                        $this->redirect = $this->url->replace('update' . $this->cid, 'show' . $this->cid)->get();
                    }

                }

                break;
            case "insert":

                if ($this->on("error")) {
                    $this->status = "create";
                }
                if ($this->on("success")) {
                    $this->status = "show";
                    if (in_array('insert',$this->back_on)) {
                        $this->redirect = $this->back_url;
                    } else {
                        $this->redirect = $this->url->remove('insert' . $this->cid)->append('show' . $this->cid, $this->model->getKey())->get();
                    }

                }
                break;
            case "delete":
                if ($this->on("error")) {
                    $this->message(trans('rapyd::rapyd.err'));
                }
                if ($this->on("success")) {
                    if (in_array('do_delete',$this->back_on)) {
                        $this->redirect = $this->back_url;
                    } else {
                        $this->message(trans('rapyd::rapyd.deleted'));
                    }

                }
                break;
        }

        switch ($this->status) {
            case "delete":
                $this->message(trans('rapyd::rapyd.conf_delete'));
                break;
            case "unknow_record":
                $this->message(trans('rapyd::rapyd.err_unknown'));
                break;
        }
    }

    /**
     * enable auto-back feature on given actions
     * @param  string $actions
     * @param  string $uri
     * @return $this
     */
    public function back($actions='insert|update|do_delete', $url="")
    {

        if ($url == "") {
            if (count($this->links)) {
                $url = array_pop($this->links);
            } else {
                return $this;
            }
        } else {
            $base = str_replace(Request::path(),'',strtok(Request::fullUrl(),'?'));
            $match_url = str_replace($base, '/', strtok($url,'?'));
            if (Request::path()!= $match_url) {
                $url = Persistence::get($match_url);
            }
        }

        $this->back_on = explode("|", $actions);
        $this->back_url = $url;

        return $this;
    }

    /**
     * it build standard buttons depending on current status
     */
    protected function buildButtons()
    {
        // load button position defaults. We could load these into an array however we would still need to provide
        // a failsafe check for each setting so long hand here reduces processing overall
        $saveButtonPosition = Config::get('rapyd.data_edit.button_position.save') != '' ? Config::get('rapyd.data_edit.button_position.save') : 'BL';
        $showButtonPosition = Config::get('rapyd.data_edit.button_position.show') != '' ? Config::get('rapyd.data_edit.button_position.show') : 'TR';
        $modifyButtonPosition = Config::get('rapyd.data_edit.button_position.modify') != '' ? Config::get('rapyd.data_edit.button_position.modify') : 'TR';
        $undoButtonPosition = Config::get('rapyd.data_edit.button_position.undo') != '' ? Config::get('rapyd.data_edit.button_position.undo') : 'TR';
        $deleteButtonPosition = Config::get('rapyd.data_edit.button_position.delete') != '' ? Config::get('rapyd.data_edit.button_position.delete') : 'BL';

        //show
        if ($this->status == "show") {

            $this->link($this->url->replace('show' . $this->cid, 'modify' . $this->cid)->get(), trans('rapyd::rapyd.modify'), $showButtonPosition);

        }

        //modify
        if ($this->status == "modify") {
            if (in_array('update',$this->back_on)) {
                $this->link($this->back_url, trans('rapyd::rapyd.undo'), $undoButtonPosition);
            } else {
                $this->link($this->url->replace('modify' . $this->cid, 'show' . $this->cid)->replace('update' . $this->cid, 'show' . $this->cid)->get(), trans('rapyd::rapyd.undo'), $modifyButtonPosition);
            }

            $this->submit(trans('rapyd::rapyd.save'), $saveButtonPosition);
        }
        //crete
        if ($this->status == "create" && $this->action!= 'delete') {
            $this->submit(trans('rapyd::rapyd.save'), $saveButtonPosition);
        }
        //delete
        if ($this->status == "delete") {
            if (in_array('do_delete',$this->back_on)) {
                $this->link($this->back_url, trans('rapyd::rapyd.undo'), $undoButtonPosition);
            } else {
                $this->link($this->url->replace('delete' . $this->cid, 'show' . $this->cid)->replace('do_delete' . $this->cid, 'show' . $this->cid)->get(), trans('rapyd::rapyd.undo'), $deleteButtonPosition);
            }

            $do_delete_url = $this->url->replace('delete' . $this->cid, 'do_delete' . $this->cid)->get();
            $this->formButton($do_delete_url, 'delete', trans('rapyd::rapyd.delete'), $deleteButtonPosition);
        }
    }

    /**
     * just an alias for getForm()
     * @param  string $view
     * @return string the form output
     */
    public function getEdit($view = '')
    {
        return $this->getForm($view);
    }

}
