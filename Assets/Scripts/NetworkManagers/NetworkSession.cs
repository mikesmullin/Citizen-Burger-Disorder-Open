using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class NetworkSession : MonoBehaviour {

	public bool Connected = false;
	public bool Server = false;
	private HostData currentHost;

	void OnServerInitialized()
	{
		Connected = true;
		Server = true;
	}
	
	void OnConnectedToServer()
	{
		Connected = true;
		Server = false;
	}
}
