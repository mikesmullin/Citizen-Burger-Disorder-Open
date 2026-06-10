using UnityEngine;
using System.Collections;

public class NetworkObjectSpawner : MonoBehaviour {

	public static NetworkObjectSpawner networkSpawner;

	// foods
	public GameObject Patty;
	public GameObject Cheese;
	public GameObject LettuceFull;
	public GameObject LettuceHalf;
	public GameObject Lettuce;
	public GameObject Bacon;
	public GameObject Tomato;
	public GameObject BunTop;
	public GameObject BunBottom;

	// food tools
	public GameObject Knife;
	public GameObject Spatula;
	public GameObject Plate;

	// general tools
	public GameObject FireExtinguisher;

	// misc
	public GameObject Drawer;
	public GameObject Box;
	public GameObject BoxOpened;
	public GameObject SpeechBubble;

	// Weird server stuff
	public GameObject ServerBox;

	// A big dumb list of enums
	public enum PrefabList
	{
		Patty,
		Cheese,
		LettuceFull,
		LettuceHalf,
		Lettuce,
		Bacon,
		Tomato,
		BunTop,
		BunBottom,

		Knife,
		Spatula,
		Plate,

		FireExtinguisher,

		Drawer,
		Box,
		BoxOpened,
		SpeechBubble,

		ServerBox
	}

	// Use this for initialization
	void Start () {
		networkSpawner = this;
	}

	public int PrefabToInt(PrefabList prefab)
	{
		return (int)prefab;
	}

	GameObject IntToPrefab(int id)
	{
		PrefabList prefabID = (PrefabList)id;

		switch(prefabID)
		{
		case PrefabList.Patty:
			return Patty;
			break;
		case PrefabList.Cheese:
			return Cheese;
			break;
		case PrefabList.LettuceFull:
			return LettuceFull;
			break;
		case PrefabList.LettuceHalf:
			return LettuceHalf;
			break;
		case PrefabList.Lettuce:
			return Lettuce;
			break;
		case PrefabList.Bacon:
			return Bacon;
			break;
		case PrefabList.Tomato:
			return Tomato;
			break;
		case PrefabList.BunTop:
			return BunTop;
			break;
		case PrefabList.BunBottom:
			return BunBottom;
			break;

		case PrefabList.Knife:
			return Knife;
			break;
		case PrefabList.Spatula:
			return Spatula;
			break;
		case PrefabList.Plate:
			return Plate;
			break;

		case PrefabList.FireExtinguisher:
			return FireExtinguisher;
			break;

		case PrefabList.Drawer:
			return Drawer;
			break;
		case PrefabList.Box:
			return Box;
			break;
		case PrefabList.BoxOpened:
			return BoxOpened;
			break;
		case PrefabList.SpeechBubble:
			return SpeechBubble;
			break;

		case PrefabList.ServerBox:
			return ServerBox;
			break;

		default:
			return Patty;
			break;
		}
	}

	public GameObject Create(PrefabList prefab, Vector3 pos, Quaternion rot, NetworkViewID newID)
	{
		if(Network.isServer)
		{
			GameObject newGO = GameObject.Instantiate(IntToPrefab((int)prefab), pos, rot) as GameObject;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;

			GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.Others,
			                (int)prefab,
			                pos,
			                rot,
			                newID);

			return newGO;
		}

		return null;
	}

	public GameObject Create(string prefabLoc, Vector3 pos, Quaternion rot, NetworkViewID newID)
	{
		if(Network.isServer)
		{
			GameObject newGO = GameObject.Instantiate(Resources.Load(prefabLoc), pos, rot) as GameObject;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;

			GetComponent<NetworkView>().RPC("InitObject", RPCMode.Others,
			                prefabLoc,
			                pos,
			                rot,
			                newID);

			return newGO;
		}
		return null;
	}

	public GameObject Create(PrefabList prefab, Vector3 pos, Quaternion rot, NetworkViewID newID, NetworkViewID parentID)
	{
		if(Network.isServer)
		{
			GameObject newGO = GameObject.Instantiate(IntToPrefab((int)prefab), pos, rot) as GameObject;
			newGO.transform.parent = NetworkView.Find(parentID).transform;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;
			
			GetComponent<NetworkView>().RPC("InitObjectPrefabWithParent", RPCMode.Others,
			                                (int)prefab,
			                                pos,
			                                rot,
			                                newID,
			                                parentID);
			
			return newGO;
		}
		return null;
	}

	public GameObject Create(string prefabLoc, Vector3 pos, Quaternion rot, NetworkViewID newID, NetworkViewID parentID)
	{
		if(Network.isServer)
		{
			GameObject newGO = GameObject.Instantiate(Resources.Load(prefabLoc), pos, rot) as GameObject;
			newGO.transform.parent = NetworkView.Find(parentID).transform;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;

			GetComponent<NetworkView>().RPC("InitObjectWithParent", RPCMode.Others,
			                prefabLoc,
			                pos,
			                rot,
			                newID,
			                parentID);

			return newGO;
		}
		return null;
	}

	public void Destroy(NetworkViewID targetToDestroy)
	{
		GetComponent<NetworkView>().RPC("DestroyObject", RPCMode.All,
		                targetToDestroy);
	}
	
	[RPC]
	void InitObjectPrefab(int prefabID, Vector3 pos, Quaternion rot, NetworkViewID newID)
	{
		try
		{
			GameObject newGO = GameObject.Instantiate(IntToPrefab(prefabID), pos, rot) as GameObject;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;
			
			print ("Created " + newGO.name + " at " + pos + " with id " + newID);
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit!");
		}
	}

	[RPC]
	void InitObject(string PrefabLocation, Vector3 pos, Quaternion rot, NetworkViewID newID)
	{
		try
		{
			GameObject newGO = GameObject.Instantiate(Resources.Load(PrefabLocation), pos, rot) as GameObject;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;
			
			print ("Created " + newGO.name + " at " + pos + " with id " + newID);
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit!");
		}
	}

	[RPC]
	void InitObjectPrefabWithParent(int prefabID, Vector3 pos, Quaternion rot, NetworkViewID newID, NetworkViewID parentID)
	{
		try
		{
			GameObject newGO = GameObject.Instantiate(IntToPrefab(prefabID), pos, rot) as GameObject;
			newGO.transform.parent = NetworkView.Find(parentID).transform;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;
			
			print ("Created " + newGO.name + " at " + pos + " with id " + newID + " and parent " + newGO.transform.parent);
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit!");
		}
	}

	[RPC]
	void InitObjectWithParent(string PrefabLocation, Vector3 pos, Quaternion rot, NetworkViewID newID, NetworkViewID parentID)
	{
		try
		{
			GameObject newGO = GameObject.Instantiate(Resources.Load(PrefabLocation), pos, rot) as GameObject;
			newGO.transform.parent = NetworkView.Find(parentID).transform;
			newGO.GetComponent<NetworkView>().viewID = newID;
			newGO.GetComponent<NetworkObject>().hasBeenInit = true;
			
			print ("Created " + newGO.name + " at " + pos + " with id " + newID + " and parent " + newGO.transform.parent);
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit!");
		}
	}

	[RPC]
	void SyncParent(NetworkViewID targetID, NetworkViewID parentID)
	{
		try
		{
			NetworkView.Find(targetID).transform.parent = NetworkView.Find(parentID).transform;
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit!");
		}
	}

	[RPC]
	void DestroyObject(NetworkViewID destroyID)
	{
		try
		{
			Transform target = NetworkView.Find(destroyID).transform;
			GameObject.Destroy(target.gameObject);
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit to destroy!");
		}
	}

	[RPC]
	/* this isn't actually a buffered call by itself, needs to be set by RPC.Buffered or whatever */
	void DestroyObjectBuffered(NetworkViewID destroyID)
	{
		try
		{
			Transform target = NetworkView.Find(destroyID).transform;
			GameObject.Destroy(target.gameObject);
		}
		catch(UnityException e)
		{
			print ("Couldn't find this shit to destroy!");
		}
	}
}
