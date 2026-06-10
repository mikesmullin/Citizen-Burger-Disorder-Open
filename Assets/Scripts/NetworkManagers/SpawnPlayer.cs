using UnityEngine;
using System.Collections;

public class SpawnPlayer : MonoBehaviour {

	public Transform PlayerPrefab;

	// Run on the server
	void OnPlayerConnected(NetworkPlayer player)
	{
		Debug.Log("A player joined!");
	}

	public void Spawn()
	{		
		print("Spawning!");
		
		Camera.main.transform.rotation = Quaternion.Euler(0, 0, 0);
		Camera.main.transform.position = Vector3.zero;
		
		Transform P;
		
		P = (Transform)Network.Instantiate(PlayerPrefab, transform.position, transform.rotation, 0);
		
		if(PlayerPrefs.GetString("Username")=="Kritz")
		{
			GetComponent<NetworkView>().RPC("SetPlayerTexture", RPCMode.AllBuffered, P.GetComponent<NetworkView>().viewID, "Kritz");
		}
		else
			GetComponent<NetworkView>().RPC("SetPlayerTexture", RPCMode.AllBuffered, P.GetComponent<NetworkView>().viewID, Random.Range(1,7+1) + "staff");

		MouseLook ml = Camera.main.GetComponent<MouseLook>();
		FollowGameObject fgo = Camera.main.GetComponent<FollowGameObject>();
		
		foreach(Transform child in P.transform)
		{
			foreach(Transform childChildWhat in child.transform)
			{
				childChildWhat.GetComponent<Renderer>().enabled = false;	
			}
			
			child.GetComponent<Renderer>().enabled = false;	
		}
		
		P.transform.GetComponent<Renderer>().enabled = false;

		ml.enabled = true;
		fgo.follow = P.gameObject;
		fgo.enabled = true;
		
		P.GetComponent<NetworkView>().RPC("SetUsername", RPCMode.AllBuffered, P.GetChild(0).FindChild("Username").GetComponent<NetworkView>().viewID, PlayerPrefs.GetString("Username"));
//		m.GetComponent<NetworkView>().RPC ("GetPlayerUsername", RPCMode.Server, Network.player.externalIP, PlayerPrefs.GetString("Username"));
		
		if(PlayerPrefs.GetFloat("sensitivity")==0) PlayerPrefs.SetFloat("sensitivity", 10);
		
		ml.sensitivityX = PlayerPrefs.GetFloat("sensitivity");
		ml.sensitivityY = ml.sensitivityX;

		FirstPersonControl fpc = P.GetComponent<FirstPersonControl>();
		fpc.camera = Camera.main;
	}

	[RPC]
	void SetPlayerTexture(NetworkViewID playerID, string textureName)
	{
		Transform player = NetworkView.Find(playerID).transform;
		
		player.GetComponent<Renderer>().material = Resources.Load("Skins/Materials/" + textureName) as Material;
	}

	/*
	public Transform player;

	bool disconnected = false;
	string disconnectedMessage = "";
*/
	/*
	void OnLevelWasLoaded(int level)
	{		
		if(level == 1)
		{
			print ("Level 1 was loaded");

			Spawn();
			
			Network.isMessageQueueRunning = true;
			
			if(Network.isServer)
			{
				foreach(GameObject spawner in GameObject.FindGameObjectsWithTag("Spawner"))
				{
					spawner.GetComponent<SpawnNPC>().enabled = true;
				}	
			}
		}
		
		Screen.lockCursor = true;
	}
	
	void OnDisconnectedFromServer(NetworkDisconnection info)
	{
		if (Network.isServer)
		{
			disconnectedMessage = "Local server connection disconnected.";
			Debug.Log("Local server connection disconnected");
		}
		else
		{
			if (info == NetworkDisconnection.LostConnection)
			{
				disconnectedMessage = "Lost connection to server.";
				Debug.Log("Lost connection to the server");
			}
			else
			{
				disconnectedMessage = "Disconnected from server.";
				Debug.Log("Successfully diconnected from the server");
			}
		}

		disconnected = true;
		menu m = Camera.main.GetComponent<menu>();
		m.enabled = true;
		m.currentMenu = menu.MenuGUIStates.pauseMenu;
	}

	void OnPlayerDisconnected(NetworkPlayer player)
	{
		Screen.lockCursor = false;
		Network.RemoveRPCs(player);
		Network.DestroyPlayerObjects(player);
	}

	void OnGUI()
	{
		if(disconnected)
		{
			GUI.skin.label.normal.textColor = Color.white;
			GUI.Label(new Rect(Screen.width/2 - 200,200,400,100), disconnectedMessage);
		}
	}
	*/
	
	/*
	void OnPlayerConnected(NetworkPlayer player)
	{
		menu m = Camera.main.GetComponent<menu>();
		
		float averagePing = 0;
		float ping = 0;
		int count = 0;
		
		foreach(NetworkPlayer netPlayer in Network.connections)
		{
			ping += Network.GetAveragePing(netPlayer);
			count++;
		}
		
		if(count!=0) averagePing = ping / count;
		else averagePing = 999;
		
		MasterServer.RegisterHost(m.versionName, PlayerPrefs.GetString("Username") + "'s Server", averagePing + "ms");
	}
	*/

	/*
	void Awake()
	{
		Spawn();
	}

	public void Spawn()
	{		
		print("Spawning!");
		
		Camera.main.transform.rotation = Quaternion.Euler(0, 0, 0);
		Camera.main.transform.position = Vector3.zero;
		
		Transform P;
		
		P = (Transform)Network.Instantiate(player, transform.position, transform.rotation, 0);
		
		if(PlayerPrefs.GetString("Username")=="Kritz")
		{
			GetComponent<NetworkView>().RPC("SetPlayerTexture", RPCMode.AllBuffered, P.GetComponent<NetworkView>().viewID, "Kritz");
		}
		else
			GetComponent<NetworkView>().RPC("SetPlayerTexture", RPCMode.AllBuffered, P.GetComponent<NetworkView>().viewID, Random.Range(1,7+1) + "staff");
		
		menu m = Camera.main.GetComponent<menu>();
		MouseLook ml = Camera.main.GetComponent<MouseLook>();
		FollowGameObject fgo = Camera.main.GetComponent<FollowGameObject>();
		
		foreach(Transform child in P.transform)
		{
			foreach(Transform childChildWhat in child.transform)
			{
				childChildWhat.GetComponent<Renderer>().enabled = false;	
			}
			
			child.GetComponent<Renderer>().enabled = false;	
		}

		P.transform.GetComponent<Renderer>().enabled = false;
		
		m.enabled = false;
		m.currentMenu = menu.MenuGUIStates.pauseMenu;
		ml.enabled = true;
		fgo.follow = P.gameObject;
		fgo.enabled = true;
		
		P.GetComponent<NetworkView>().RPC("SetUsername", RPCMode.AllBuffered, P.GetChild(0).FindChild("Username").GetComponent<NetworkView>().viewID, PlayerPrefs.GetString("Username"));
		m.GetComponent<NetworkView>().RPC ("GetPlayerUsername", RPCMode.Server, Network.player.externalIP, PlayerPrefs.GetString("Username"));

		if(PlayerPrefs.GetFloat("sensitivity")==0) PlayerPrefs.SetFloat("sensitivity", 10);

		ml.sensitivityX = PlayerPrefs.GetFloat("sensitivity");
		ml.sensitivityY = ml.sensitivityX;


		FirstPersonControl fpc = P.GetComponent<FirstPersonControl>();
		fpc.camera = Camera.main;
				
		Screen.lockCursor = true;	
	}
	
	[RPC]
	void SetPlayerTexture(NetworkViewID playerID, string textureName)
	{
		Transform player = NetworkView.Find(playerID).transform;
		
		player.GetComponent<Renderer>().material = Resources.Load("Skins/Materials/" + textureName) as Material;
	}
	*/
}
