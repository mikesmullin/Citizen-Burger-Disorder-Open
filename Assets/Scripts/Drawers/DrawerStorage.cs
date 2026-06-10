using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class DrawerStorage : MonoBehaviour {

	Transform mainDrawer;

	List<GameObject> ObjectsInside = new List<GameObject>();
	List<float> ObjectsInsideTimer = new List<float>();

	float waitTime = 2f;

	// Use this for initialization
	void Start ()
	{
		mainDrawer = transform.parent;	
	}

	void OnTriggerEnter(Collider other)
	{
		if(!ObjectsInside.Contains(other.gameObject))
		{
			if(other.GetComponent<PickupObject>() && !other.GetComponent<PickupObject>().beingHeld)
			{
				ObjectsInside.Add(other.gameObject);
				ObjectsInsideTimer.Add(Time.time);
			}
		}
	}

	void OnTriggerExit(Collider other)
	{
		if(ObjectsInside.Contains(other.gameObject))
		{
			int index = ObjectsInside.IndexOf(other.gameObject);

			ObjectsInside.RemoveAt(index);
			ObjectsInsideTimer.RemoveAt(index);
		}
	}

	void OnTriggerStay(Collider other)
	{
		if(Network.peerType != NetworkPeerType.Disconnected)
		{
			if(other.GetComponent<PickupObject>())
			{
				PickupObject obj = other.GetComponent<PickupObject>();

				if(!ObjectsInside.Contains(other.gameObject))
				{
					if(other.GetComponent<PickupObject>() && !other.GetComponent<PickupObject>().beingHeld)
					{
						ObjectsInside.Add(other.gameObject);
						ObjectsInsideTimer.Add(Time.time);
					}
				}

				if(other.GetComponent<Rigidbody>() && !obj.beingHeld)
				{
					if(other.GetComponent<Rigidbody>().velocity.magnitude < 0.3f
					   ||
					   other.GetComponent<Rigidbody>().velocity.magnitude < 0.9f
					   &&
					  (other.GetComponent<Rigidbody>().velocity - mainDrawer.GetComponent<Rigidbody>().velocity).magnitude < 0.5f)
					{
						if(ObjectsInside.Contains(other.gameObject))
						{
							int index = ObjectsInside.IndexOf(other.gameObject);

							if(ObjectsInsideTimer[index] + waitTime < Time.time)
							{
								obj.beingStored = true;
								// force sync position to other network users
								other.GetComponent<NetworkView>().RPC("SetObjectPosition", RPCMode.All, other.transform.position, other.transform.rotation, other.GetComponent<NetworkView>().viewID);
								
								// other stuff
								other.GetComponent<NetworkView>().RPC("SetParent", RPCMode.All, other.GetComponent<NetworkView>().viewID, mainDrawer.GetComponent<NetworkView>().viewID, "drawer");
								other.GetComponent<NetworkView>().RPC("SetActive", RPCMode.All, other.GetComponent<NetworkView>().viewID, false);
								other.GetComponent<NetworkView>().RPC("DestroyRigidbody", RPCMode.All, other.GetComponent<NetworkView>().viewID);
								other.GetComponent<NetworkView>().RPC("SetObservedToTransform", RPCMode.All, other.GetComponent<NetworkView>().viewID);
							}
						}
					}
				}
			}
		}
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
