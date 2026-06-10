using UnityEngine;
using System.Collections;
using System.Collections.Generic;

[RequireComponent (typeof (NetworkObject))]
public class PickupObject : MonoBehaviour {

	public bool createdInScene = false; // was this object created by a player, or present in the level at startup? Important for RPC destroy calls.

	public NetworkObject netObject;
	public GameObject armHoldingObject;
	public FirstPersonControl playerHolding;
	public FirstPersonControl lastPlayerHolding;

	public Vector3 MoveGoalPosition = Vector3.zero;

	public bool fixedInPlace = false;

	public bool beingStored = false;
	public bool beingHeld = false;
	public bool beingUsed = false;
	public Vector3 heldPositionOffset = new Vector3(0,1,1); // Specify where this object appears relative to the hand that holds it. Values will be muliplied against default pos. 1= default.
	public float heldRotateXOffset = -30;
	float currentHeldRotateXOffset;

	public Vector3[] positionHistory;
	float positionCheckRate = 0.01f;
	float lastCheckedTime = 0;
	int maxHistory = 3;

	void OnCollisionEnter(Collision collision)
	{
		float mag = 0;
		if(GetComponent<Rigidbody>()) mag = GetComponent<Rigidbody>().velocity.magnitude;

		if(GetComponent<Food>())
		{
			Food f = GetComponent<Food>();



			if(f.type == Food.FoodType.bacon || f.type == Food.FoodType.cheese ||
			   f.type == Food.FoodType.patty || f.type == Food.FoodType.tomato)
			{
				if(FirstPersonControl.localPlayer)
					FirstPersonControl.localPlayer.audioLibrary.PlayWetAudio(transform.position);
			}
			else
			{

				if(FirstPersonControl.localPlayer)
					FirstPersonControl.localPlayer.audioLibrary.PlayDryAudio(transform.position);
			}
		}

		if(gameObject.layer == LayerMask.NameToLayer("Plate"))
		{
			if(mag<6) mag=4;
//			print ((mag-6)/(15-6));

			if(FirstPersonControl.localPlayer)
				FirstPersonControl.localPlayer.audioLibrary.PlayPlateAudio(transform.position, (mag)/(15));
		}
	}

	void Awake()
	{
		netObject = GetComponent<NetworkObject>();	
		currentHeldRotateXOffset = heldRotateXOffset;
		positionHistory = new Vector3[maxHistory];

		for(int i=0; i<maxHistory; i++)
		{
			positionHistory[i] = Vector3.zero;
		}
	}

	public void ResetHeldRotation()
	{
		currentHeldRotateXOffset = heldRotateXOffset;
	}
	
	void Update()
	{
		if(beingHeld && playerHolding && !playerHolding.GetComponent<NetworkView>().isMine)
		{
			if(armHoldingObject!=null)
			{
				if(!fixedInPlace)
				{
					Vector3 pos = armHoldingObject.transform.FindChild("hand").transform.position + armHoldingObject.transform.FindChild("hand").transform.forward * 2F * heldPositionOffset.z
								+ armHoldingObject.transform.FindChild("hand").transform.right * heldPositionOffset.x
							+ playerHolding.transform.up * heldPositionOffset.y;
					Quaternion rot = armHoldingObject.transform.rotation * Quaternion.Euler(0, 0, 0);

					transform.position = Vector3.Lerp(transform.position, pos, 30F * Time.deltaTime);
					transform.rotation = Quaternion.Lerp(transform.rotation, rot, 30F * Time.deltaTime);
				}
			}

			if(armHoldingObject && MoveGoalPosition!=Vector3.zero)
			{
				transform.position = Vector3.Lerp(transform.position, MoveGoalPosition, 5f * Time.deltaTime);
			}
		}

		if(beingHeld && GetComponent<NetworkView>().isMine)
		{
			if(lastCheckedTime + positionCheckRate < Time.time)
			{
				lastCheckedTime = Time.time;

				for(int i=1; i<maxHistory; i++)
				{
					positionHistory[i-1] = positionHistory[i];
				}
				positionHistory[maxHistory-1] = transform.position;

				/*
				if(positionHistory.Count>maxHistory)
				{
					positionHistory.RemoveAt(0);
				}
				
				positionHistory.Add(transform.position);
				*/
			}
		}
	}

	[RPC]
	void SetActive(NetworkViewID tID, bool active)
	{
		// actually sets it to the ID's child
		Transform target = NetworkView.Find(tID).transform;
		if(target.GetComponent<Food>()) target.GetComponent<Food>().enabled = active;
		if(target.GetComponent<Plate>()) target.GetComponent<Plate>().enabled = active;
		if(target.GetComponent<Rat>()) target.GetComponent<Rat>().enabled = active;
		target.GetComponent<NetworkObject>().enabled = active;
		
		if(target.GetComponent<PickupObject>()) target.GetComponent<PickupObject>().enabled = active;
	}

	[RPC]
	void DestroyRigidbody(NetworkViewID tID)
	{
		Transform t = NetworkView.Find(tID).transform;
		Destroy(t.gameObject.GetComponent<Rigidbody>());
	}

	[RPC]
	void AddRigidbody(NetworkViewID tID)
	{
		Transform t = NetworkView.Find(tID).transform;
		t.gameObject.AddComponent<Rigidbody>();
	}
	
	[RPC]
	void SetObservedToTransform(NetworkViewID id)
	{
		Transform target = NetworkView.Find(id).transform;
		
		target.GetComponent<NetworkView>().observed = target;
	}
	
	[RPC]
	void SetObservedToRigidbody(NetworkViewID id)
	{
		Transform target = NetworkView.Find(id).transform;

		if(target.GetComponent<Rigidbody>())
			target.GetComponent<NetworkView>().observed = target.GetComponent<Rigidbody>();
	}

	[RPC]
	void SetObservedToNetworkObj(NetworkViewID id)
	{
		Transform target = NetworkView.Find(id).transform;
		
		if(target.GetComponent<Rigidbody>())
			target.GetComponent<NetworkView>().observed = target.GetComponent<NetworkObject>();
	}

	// actually sets it to the ID's child
	[RPC]
	void SetParent(NetworkViewID targetID, NetworkViewID parentID, string type="")
	{
		Transform target;
		Transform newParent;

		try
		{
			target = NetworkView.Find(targetID).transform;
			newParent = NetworkView.Find(parentID).transform;
		}
		catch(UnityException e)
		{
			Debug.Log(e);
			return;
		}

		if(type=="burger")
		{
			newParent = newParent.GetChild(0);
		}

		target.transform.parent = newParent;
	}

	[RPC]
	void UnsetParent(NetworkViewID targetID)
	{
		Transform target;
		
		try
		{
			target = NetworkView.Find(targetID).transform;
		}
		catch(UnityException e)
		{
			Debug.Log(e);
			return;
		}

		target.transform.parent = null;
	}

	/* Shoots a destroy call to NetworkObjectSpawner. */
	public void DestroyObject()
	{
		// Rework this with a proper creation / destroy function that doesn't rely on buffers, as this causes bad game states!
		if(Network.isServer)
		{
			if(GetComponent<Flamable>())
			{
				Flamable f = GetComponent<Flamable>();
				f.FireBurnOut();
			}

			if(createdInScene)
			{
				NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("DestroyObjectBuffered", RPCMode.AllBuffered, this.gameObject.GetComponent<NetworkView>().viewID);
			}
			else
			{
				NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("DestroyObject", RPCMode.All, this.gameObject.GetComponent<NetworkView>().viewID);
			//	Network.RemoveRPCs(this.gameObject.networkView.viewID);
			//	Network.Destroy(this.gameObject);
			}
		}
	}

	[RPC]
	public void SetBeingHeld(NetworkViewID objectID, bool held, NetworkViewID arm, NetworkViewID playerID)
	{
		PickupObject obj = NetworkView.Find(objectID).transform.GetComponent<PickupObject>();

//		print ("this being held ("+held+"): " + name);

		obj.beingHeld = held;
		
		if(held==true)
		{
			this.armHoldingObject = NetworkView.Find(arm).gameObject;
			this.playerHolding = NetworkView.Find(playerID).transform.GetComponent<FirstPersonControl>();
			lastPlayerHolding = playerHolding;
		}
		else
		{
			this.armHoldingObject = null;
			this.playerHolding = null;
		}
	}
	
	public bool IsBeingUsed()
	{
		bool used = false;
		
		if(GetComponent<ObjectUsable>()) used = GetComponent<ObjectUsable>().beingUsed;
		
		return used;
	}
}
