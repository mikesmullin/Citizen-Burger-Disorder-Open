using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Plate : MonoBehaviour {
	
	public List<Food> foodOnPlate = new List<Food>();

	public GameObject foodBaseObject;
		
	void OnTriggerStay(Collider other)
	{				
		if(
			foodOnPlate.Count == 0
			&& other.GetComponent<Rigidbody>()
			&&
			(
			other.name.Contains("bun-bottom")
		    && other.transform.GetChild(0).FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger.Count>0
		    && other.transform.GetChild(0).FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodCount(Food.FoodType.topBun)>0
		    )
			&& !other.GetComponent<PickupObject>().beingHeld
			&& other.transform.parent != transform.parent
			&& transform.parent.GetComponent<Rigidbody>().useGravity
			&& other.GetComponent<Food>()
		)
		{
			print ("yeaaaah!");

			Food f = other.GetComponent<Food>();
			
			if(!foodOnPlate.Contains(f))
			{
				foodBaseObject = other.gameObject;

				if(Network.isServer)
				{
					other.GetComponent<NetworkView>().RPC("AddFoodToPlate", RPCMode.AllBuffered, other.GetComponent<NetworkView>().viewID, transform.parent.GetComponent<NetworkView>().viewID);

					other.GetComponent<NetworkView>().RPC("SetObjectPosition", RPCMode.All, other.transform.position, other.transform.rotation, other.GetComponent<NetworkView>().viewID);
					other.GetComponent<NetworkView>().RPC("SetParent", RPCMode.All, other.GetComponent<NetworkView>().viewID, transform.parent.GetComponent<NetworkView>().viewID, "plate");
					other.GetComponent<NetworkView>().RPC("DestroyRigidbody", RPCMode.All, other.GetComponent<NetworkView>().viewID);
					other.GetComponent<NetworkView>().RPC("SetActive", RPCMode.All, other.GetComponent<NetworkView>().viewID, false);
					other.GetComponent<NetworkView>().RPC("SetObservedToTransform", RPCMode.All, other.GetComponent<NetworkView>().viewID);
				}
				
				transform.parent.GetComponent<Renderer>().material.SetFloat("_Blend", 0.2f);
				
				if(f.type == Food.FoodType.bun)
				{
					other.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().enabled = false;
				}
			}
		}
	}

	public void DetachFoodFromPlate()
	{
		if(Network.isServer && foodBaseObject && foodOnPlate.Count>0)
		{
			foodOnPlate.Clear();

			foodBaseObject.GetComponent<NetworkView>().RPC("SetObjectPosition", RPCMode.All, foodBaseObject.transform.position, foodBaseObject.transform.rotation, foodBaseObject.GetComponent<NetworkView>().viewID);
			foodBaseObject.GetComponent<NetworkView>().RPC("UnsetParent", RPCMode.All, foodBaseObject.GetComponent<NetworkView>().viewID);
			foodBaseObject.GetComponent<NetworkView>().RPC("AddRigidbody", RPCMode.All, foodBaseObject.GetComponent<NetworkView>().viewID);
			foodBaseObject.GetComponent<NetworkView>().RPC("SetActive", RPCMode.All, foodBaseObject.GetComponent<NetworkView>().viewID, true);
			foodBaseObject.GetComponent<NetworkView>().RPC("SetObservedToNetworkObj", RPCMode.All, foodBaseObject.GetComponent<NetworkView>().viewID);
		}
	}
	
	public int foodCount(Food.FoodType type)
	{
		int r=0;
		
		foreach (Food f in foodOnPlate)
		{
			if(f.type == type) r++;
		}
		return r;			
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
