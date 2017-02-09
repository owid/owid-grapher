<?php namespace App\Http\Controllers;

use App\User;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;
use Invite;
use Auth;
use Hash;

class UsersController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$users = User::orderBy('created_at', 'desc')->get();
		return view('users.index', compact('users'));
	}

	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create()
	{
		//
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store()
	{
		//
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  User  $user
	 * @return Response
	 */
	public function show(User $user)
	{
		return view('users.show', compact('user'));
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  User $user
	 * @return Response
	 */
	public function edit(User $user)
	{
		return view('users.edit', compact('user'));
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  User $user
	 * @return Response
	 */
	public function update(User $user, Request $request)
	{
		$input = array_except($request->all(), [ '_method', '_token' ]);
		$user->update($input);


		Cache::flush();
		
		return redirect()->route('licenses.show', $license->id)->with('message', 'License updated.')->with('message-class', 'success');
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy($id)
	{
	}

	public function invite(Request $request) {
		$email = $request->input('email');

		$user = Auth::user();
		$refCode = Invite::invite($email, $user->id);

		return $refCode;
	}

	public function signup(Request $request) {
		$code = $request->input('code');
	    $invitation = Invite::get($code);

		if (!Invite::isExpired($code) && $invitation->status == 'successful') {
			Auth::login($invitation->user);
			return redirect()->to('/');
		}

		if (Invite::isValid($code)) {
		    return view('users.signup', ['invitation' => $invitation]);
//		    $referral_user = $invitation->user;
		} else {
		    $status = Invite::status($code);
		    return $status;
		}		
	}

	public function signupSubmit(Request $request) {
		$this->validate($request, [
			'name' => 'required|unique:users',
			'password' => 'required|min:12',
			'code' => 'required'
		]);

		$invitation = Invite::get($request->input('code'));

		User::create([
			'email' => $invitation->email,
			'name' => $request->input('name'),
			'password' => Hash::make($request->input('password'))
		]);

        if (Auth::attempt(['email' => $invitation->email, 'password' => $request->input('password')], true)) {
		    Invite::consume($request->input('code'));
	        return redirect()->to('/');
        }
	}
}
