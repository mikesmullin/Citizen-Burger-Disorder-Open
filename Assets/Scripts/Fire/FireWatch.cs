using UnityEngine;
using System.Collections;
using System.Collections.Generic;

// FireWatch catalogues all existing fires within the level and should be used for creating and destroying new fires. It will also sync fires between players.
public class FireWatch : MonoBehaviour
{
	public static List<FireAnimate> AllFireAnimates = new List<FireAnimate>();	// All fires in the scene. I swear this is a legitimate use of 'static'.
	GameObject firePrefab; // The fire prefab object to spawn

	void Start()
	{
		// Unity occasionally drops prefab links
		firePrefab = Resources.Load("Prefabs/Fire/Fire") as GameObject;
	}

	/**
		Syncs all fire objects currently in scene with a player connecting. Runs automatically by server.
	*/
	void OnPlayerConnected(NetworkPlayer player)
	{
		foreach(FireAnimate f in AllFireAnimates)
		{
			// Detect if the fire is attached to an object (a small fire) or by itself (big fire).
			if(f.fireBase)
			{
				GetComponent<NetworkView>().RPC("CreateFireAnimate", player, f.transform.position, f.transform.rotation, f.fireBase.nearBigFire, f.fireBase.GetComponent<NetworkView>().viewID, f.GetComponent<NetworkView>().viewID);
			
				// Sync all important variables in the small fire. Fire spread is deterministic so after this point the client can take over the spread algo.
				GetComponent<NetworkView>().RPC("SyncAllFlamable", player, f.fireBase.GetComponent<NetworkView>().viewID, f.fireBase.isOnFire, f.fireBase.wasOnFire, f.fireBase.isFlamableAgain, f.fireBase.reflamable,
				                f.fireBase.currentBurnHealth, f.fireBase.currentTemp, f.fireBase.nearBigFire, f.fireBase.currentFireCheckRate);
			}
			else
			{
				GetComponent<NetworkView>().RPC("CreateBigFireAnimate", player, f.transform.position, f.transform.rotation, f.GetComponent<NetworkView>().viewID);
			}
		}
	}

	/**
	NETWORK CALL - 
		Create a fire!
		
		nearBigFire - Is there a large fire close to where this fire is spawning?
		callerID - Who decided to create the fire? (ie the object that caught on fire)
		newObjectID - Server pre-allocates a networkID for syncing purposes
	*/
	[RPC]
	public void CreateFireAnimate(Vector3 position, Quaternion rotation, bool nearBigFire, NetworkViewID callerID, NetworkViewID newObjectID)
	{
		// Spawn fire object
		GameObject newFire = GameObject.Instantiate(firePrefab, position, rotation) as GameObject;
		newFire.GetComponent<NetworkView>().viewID = newObjectID;
		
		print ("Created new fire with id: " + newObjectID + " , " + newFire.GetComponent<NetworkView>().viewID);
		
		// Sync fire object with caller
		SetupNewFire(newFire.GetComponent<NetworkView>().viewID, callerID, false, nearBigFire);

		if(Network.isServer)
		{
			// If the server is creating a fire on the server, it's a new fire, so add it to the list!
			AllFireAnimates.Add(newFire.GetComponent<FireAnimate>());
		}
	}

	/**
	NETWORK CALL - 
		Create a BIGGER fire!

		newObjectID - Server pre-allocates a networkID for syncing purposes
	*/
	[RPC]
	public void CreateBigFireAnimate(Vector3 position, Quaternion rotation, NetworkViewID newObjectID)
	{
		// BIG FIRE
		GameObject newFire = GameObject.Instantiate(firePrefab, position, rotation) as GameObject;
		newFire.GetComponent<NetworkView>().viewID = newObjectID;
		
		print ("Created new BIG fire with id: " + newObjectID + " , " + newFire.GetComponent<NetworkView>().viewID);
		
		SetupNewBigFire(newFire);

		// If a big fire is created near any NPCs in the world, set the NPCs on fire.
		Collider[] proximityNPCs = Physics.OverlapSphere(position, 5f);
		foreach(Collider c in proximityNPCs)
		{
			if(c.GetComponent<NPC>())
			{
				c.GetComponent<Flamable>().FireIgnite();
			}
		}

		if(Network.isServer)
		{
			AllFireAnimates.Add(newFire.GetComponent<FireAnimate>());
		}
	}

	/**
	NETWORK CALL - 
		Syncs fire between clients
		
		objectID - preallocated networkID
		creatorObjectID - the creator of this fire object (ie the object that has caught on fire)
		isLargeFire - Is this a standalone fire? If not, it should be attached to an object.
		nearBigFire - Is there another big fire within the allowable radius for more fires?
	*/
	[RPC]
	void SetupNewFire(NetworkViewID objectID, NetworkViewID creatorObjectID, bool isLargeFire, bool nearBigFire)
	{
		GameObject fir;
		Flamable flam;
		
		print ("Object id: " + objectID + ", creator: " + creatorObjectID);
		
		try
		{
			fir = NetworkView.Find(objectID).gameObject;
			flam = NetworkView.Find(creatorObjectID).GetComponent<Flamable>();
		}
		catch (UnityException e) { Debug.Log(e); return; }

		// sync all the things
		FollowGameObject fgo = fir.GetComponent<FollowGameObject>();
		
		fgo.follow = flam.gameObject;
		fgo.distance = flam.fireOffsetLocaiton;
		flam.fireAnimate = fgo.GetComponent<FireAnimate>();
		flam.fireAnimate.fireBase = flam;
		flam.nearBigFire = nearBigFire;
	}

	/**
	NETWORK CALL - 
		Big fire setup
		
		fire - The fire object we want to modify to actually MAKE it a large fire.
	*/
	void SetupNewBigFire(GameObject fire)
	{
		// a large fire is just a small fire, but larger. #science
		fire.transform.localScale =
			new Vector3(fire.transform.localScale.x * 3.5f,
			            fire.transform.localScale.y * 2.5f,
			            fire.transform.localScale.z * 2.5f);
		
		fire.GetComponent<FireAnimate>().isLargeFire = true;


	}

	/**
	NETWORK CALL - 
		Sync all the things!
		
		all the things - they get synced. For real, nothing fancy here.
	*/
	[RPC]
	void SyncAllFlamable(NetworkViewID objectID, bool nIsOnFire, bool nWasOnFire, bool nIsFlamableAgain, bool nReflamable,
	                     float nCurrentBurnHealth, float nCurrentTemp, bool nNearBigFire, float nCurrentFireCheckRate)
	{
		Flamable f;
		
		try
		{
			f = NetworkView.Find(objectID).GetComponent<Flamable>();
		}
		catch (UnityException e)
		{ 
			Debug.Log(e);
			return; 
		}
		
		f.isOnFire = nIsOnFire;
		f.wasOnFire = nWasOnFire;
		f.isFlamableAgain = nIsFlamableAgain;
		f.reflamable = nReflamable;
		f.currentBurnHealth = nCurrentBurnHealth;
		f.currentTemp = nCurrentTemp;
		f.nearBigFire = nNearBigFire;
		f.currentFireCheckRate = nCurrentFireCheckRate;
		
		if(f.isOnFire) f.FireIgnite();
	}

	public static void AddFireReference(FireAnimate newFireRef)
	{
		print ("adding fire ref");
		AllFireAnimates.Add(newFireRef);
	}

	public static void RemoveFireReference(FireAnimate removeFireRef)
	{
		AllFireAnimates.Remove(removeFireRef);
	}
}
