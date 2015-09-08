<?php

namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;
use Illuminate\Support\Facades\Input;

class File extends Field
{

    public $type = "file";
    protected $file = null;
    protected $path = 'uploads/';
    protected $web_path = '';
    protected $filename = '';
    protected $saved = '';
    protected $unlink_file = true;
    protected $upload_deferred = false;
    protected $recursion = false;

    public function rule($rule)
    {
        //we should consider rules only on upload
        if (Input::hasFile($this->name)) {
            parent::rule($rule);
        }

        return $this;
    }

    public function autoUpdate($save = false)
    {

        $this->getValue();

        if ((($this->action == "update") || ($this->action == "insert"))) {

            if (Input::hasFile($this->name)) {
                $this->file = Input::file($this->name);

                $filename = ($this->filename!='') ?  $this->filename : $this->file->getClientOriginalName();

                $this->path =  $this->parseString($this->path);
                $filename = $this->parseString($filename);
                $filename = $this->sanitizeFilename($filename);
                $this->new_value = $filename;

                //deferred upload
                if ($this->upload_deferred) {
                    if (isset($this->model) and isset($this->db_name)) {
                        $this->model->saved(function () use ($filename) {
                            if ($this->recursion) return;
                            $this->recursion = true;

                            $this->path =  $this->parseString($this->path);
                            $filename = $this->parseString($filename);
                            $filename = $this->sanitizeFilename($filename);
                            $this->new_value = $filename;
                            if ($this->uploadFile($filename)) {
                                if (is_a($this->relation, 'Illuminate\Database\Eloquent\Relations\Relation'))
                                    $this->updateRelations();
                                else
                                    $this->updateName(true);
                            }

                        });
                        $this->model->save();
                    }

                //direct upload
                } else {

                    if ($this->uploadFile($filename)) {
                        if (is_object($this->model) and isset($this->db_name)) {
                            if (is_a($this->relation, 'Illuminate\Database\Eloquent\Relations\Relation')) {
                                $this->model->saved(function () {
                                        $this->updateRelations();
                                });
                            } else {
                                $this->updateName($save);
                            }
                        }
                    }
                }

            } else {

                //unlink
                if (Input::get($this->name . "_remove")) {
                    $this->path =  $this->parseString($this->path);
                    if ($this->unlink_file) {
                        @unlink(public_path().'/'.$this->path.$this->old_value);
                    }
                    if (is_a($this->relation, 'Illuminate\Database\Eloquent\Relations\Relation')) {
                        $this->new_value = null;
                        $this->value = null;
                        $this->updateRelations();

                    }
                    if (isset($this->model) && $this->model->offsetExists($this->db_name)) {
                        $this->model->setAttribute($this->db_name, null);
                    }

                    if ($save) {
                        return $this->model->save();
                    }
                }

            }
        }

        return true;
    }

    protected function sanitizeFilename($filename)
    {
        $filename = preg_replace('/\s+/', '_', $filename);
        $filename = preg_replace('/[^a-zA-Z0-9\._-]/', '', $filename);
        $filename = $this->preventOverwrite($filename);

        return $filename;
    }

    protected function preventOverwrite($filename)
    {
        $ext = strtolower(substr(strrchr($filename, '.'), 1));
        $name = rtrim($filename, strrchr($filename, '.'));
        $i = 0;
        $finalname = $name;
        while (file_exists(public_path().'/'.$this->path . $finalname. '.'.$ext)) {
            $i++;
            $finalname = $name . (string) $i;
        }

        return $finalname. '.'.$ext;
    }

    /**
     * move uploaded file to the destination path, optionally raname it
     * name param can be passed also as blade syntax
     * unlinkable  is a bool, tell to the field to unlink or not if "remove" is checked
     * @param $path
     * @param  string $name
     * @param  bool   $unlinkable
     * @return $this
     */
    public function move($path, $name = '', $unlinkable = true, $deferred = false)
    {
        $this->path = rtrim($path,"/")."/";
        $this->filename = $name;
        $this->unlink_file = $unlinkable;
        $this->upload_deferred = $deferred;
        if (!$this->web_path) $this->web_path = $this->path;
        return $this;
    }

    /**
     * as move but deferred after model->save()
     * this way you can use ->move('upload/folder/{{ $id }}/'); using blade and pk reference
     *
     * @param $path
     * @param  string $name
     * @param  bool   $unlinkable
     * @return $this
     */
    public function moveDeferred($path, $name = '', $unlinkable = true)
    {
        return $this->move($path, $name, $unlinkable, true);
    }

    public function webPath($path)
    {
        $this->web_path = rtrim($path,"/")."/";

        return $this;
    }

    /**
     * @return update field name
     */
    protected function uploadFile($filename, $safe = false)
    {
        if ($safe) {
            try {
                $this->file->move($this->path, $filename);
                $this->saved = $this->path. $filename;
            } catch (Exception $e) {
            }
        } else {
            $this->file->move($this->path, $filename);
            $this->saved = $this->path. $filename;
        }
        \Event::fire('rapyd.uploaded.'.$this->name);

        return true;
    }

    /**
     * @return update field name
     */
    protected function updateName($save)
    {
        if (isset($this->new_value)) {
            $this->model->setAttribute($this->db_name, $this->new_value);
        } else {
            $this->model->setAttribute($this->db_name, $this->value);
        }

        if ($save) {
            return $this->model->save();
        }
    }

    public function build()
    {
        $this->path =  $this->parseString($this->path);
        $this->web_path = $this->parseString($this->web_path);
        $output = "";
        if (parent::build() === false)
            return;

        switch ($this->status) {
            case "disabled":
            case "show":

                if ($this->type == 'hidden' || $this->value == "") {
                    $output = "";
                } elseif ((!isset($this->value))) {
                    $output = $this->layout['null_label'];
                } else {
                    $output = nl2br(htmlspecialchars($this->value));
                }
                $output = "<div class='help-block'>" . $output . "&nbsp;</div>";
                break;

            case "create":
            case "modify":

                if ($this->old_value) {
                    $output .= '<div class="clearfix">';
                    $output .= link_to($this->web_path.$this->value, $this->value). "&nbsp;";
                    $output .= Form::checkbox($this->name.'_remove', 1, (bool) Input::get($this->name.'_remove'))." ".trans('rapyd::rapyd.delete')." <br/>\n";
                    $output .= '</div>';
                }
                $output .= Form::file($this->name, $this->attributes);
                break;

            case "hidden":
                $output = Form::hidden($this->name, $this->value);
                break;

            default:;
        }
        $this->output = "\n" . $output . "\n" . $this->extra_output . "\n";
    }

}
