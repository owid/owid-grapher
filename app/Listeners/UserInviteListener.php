<?php namespace App\Listeners;

class UserInviteListener {
	public function handle($invitation)
	{
	    \Mail::send('emails.invitation', ['invitation' => $invitation], function ($m) use ($invitation) {
            $m->to($invitation->email);
            $m->subject($invitation->user->name . " invited you to join owid-grapher");
        });
	}	
}
