using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class NetworkManager : MonoBehaviour {

	//							  major - minor - patch
	string versionName = "Kritz-CBD-00-06-00";

	public static NetworkManager netMan;
	public static SpawnPlayer spawner;

	public HostData[] HostList;

	public bool useNat = false;
	public int ConnectPort = 25000;
	public int ListenPort = 25001;
	public string port = "";

	// Master Server info
	// string IPAddress = "";
	// int MasterPort = 000;
	// int FacilitatorPort = 000;

	// Use this for initialization
	void Awake ()
	{
		Debug.Log("Awake!");

		spawner = GameObject.Find("Spawn").GetComponent<SpawnPlayer>();

		Init();
	}

	void Init()
	{
		UpdateNetMan();
		UpdateServerInfo();
		StartCoroutine("RefreshServerHosts");
		Connect();
	}

	IEnumerator RefreshServerHosts()
	{
		while(true)
		{
			UpdateHostList();
			yield return new WaitForSeconds(10f);
		}
	}

	public void ConnectTo(HostData host)
	{
		if(host != null)
		{
			netMan.StopAllCoroutines();
			Network.Connect(host);
		}
	}
	
	void Connect()
	{
		Debug.Log("Connecting!");

		ListenPort = ConnectPort + Random.Range(0, 100);

		// Create server
		bool useNat = !Network.HavePublicAddress();
		Network.InitializeServer(10, ListenPort, useNat);
		MasterServer.RegisterHost(versionName, "aaa");
	}

	void UpdateNetMan()
	{
		if(netMan && netMan!=this)
		{
			Destroy(this);
		}
		
		netMan = this;
		DontDestroyOnLoad(this.gameObject);
	}

	public HostData[] GetHostData()
	{
		return MasterServer.PollHostList();
	}

	void UpdateServerInfo()
	{
		MasterServer.ipAddress = IPAddress;
		MasterServer.port = MasterPort;
		Network.natFacilitatorIP = IPAddress;
		Network.natFacilitatorPort = FacilitatorPort;
	}

	public void UpdateHostList()
	{
		MasterServer.ClearHostList();
		MasterServer.RequestHostList(versionName);

		HostList = MasterServer.PollHostList();
	}

	void OnServerInitialized()
	{
		spawner.Spawn();
	}
	
	void OnConnectedToServer()
	{
		//spawner.Spawn();
	}
}
