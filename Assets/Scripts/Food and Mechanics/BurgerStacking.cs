using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class BurgerStacking : MonoBehaviour {
	
	public List<Food> foodOnBurger = new List<Food>();
	LayerMask layerMask;
	
	Vector3 originalPosition;
	
	bool lateUpdateRequired = false;
	
	int checkCount = 0;
	int maxChecks = 4;

	bool complete = false;
	
	// Update is called once per frame
	void Start () {
		layerMask = (1<<LayerMask.NameToLayer("Food"));
		originalPosition = transform.localPosition;
	}
	
	public void Reset()
	{
		GetComponent<Collider>().enabled = true;
		transform.localPosition = originalPosition;
		foodOnBurger.Clear();
	}
	
	void LateUpdate()
	{
		if(Time.frameCount % 30 == 0 && checkCount < maxChecks)
		{
			RaycastHit lateTopHit;
			
			if(Physics.Raycast(transform.position + transform.up * 2f, Vector3.down, out lateTopHit, 6F, layerMask))
			{			
				if(lateTopHit.transform!=transform && lateTopHit.transform.IsChildOf(transform.root))
				{
					Vector3 newTriggerPos = new Vector3(transform.position.x, lateTopHit.point.y, transform.position.z);
		
					if(newTriggerPos.y > transform.position.y + 0.1f)
					{
						transform.position = newTriggerPos;
					}
				}	
			}
			
			checkCount++;
		}
		
		if(lateUpdateRequired && foodOnBurger.Count>0)
		{
			RaycastHit lateTopHit;
			//Physics.Raycast(other.transform.position + other.transform.up*0.5f, Vector3.down, out lateTopHit, 6F, layerMask);
			if(Physics.Raycast(transform.position + transform.up * 2f, Vector3.down, out lateTopHit, 6F, layerMask))
			{
				if(lateTopHit.transform.IsChildOf(transform.root))
				{
					Vector3 newTriggerPos = new Vector3(transform.position.x, lateTopHit.point.y, transform.position.z);
		
					if(newTriggerPos.y > transform.position.y)
					{
						transform.position = newTriggerPos;
					}
				}
			}
		}
		
		lateUpdateRequired = false;
	}
	
	void OnTriggerStay(Collider other)
	{					
		if( this.GetComponent<Collider>().enabled && other.GetComponent<Collider>().enabled && other.GetComponent<Food>()!=null && (!other.name.Contains("bun-bottom") || (other.name.Contains("bun-bottom") && foodOnBurger.Count>0))
		   && (!other.name.Contains("bun-top") || (other.name.Contains("bun-top") && foodOnBurger.Count>0)) && other.tag == "PhysicsFood" && other.GetComponent<Rigidbody>()
			&& other.GetComponent<Food>()!=null && !transform.parent.parent.GetComponent<PickupObject>().beingHeld && other.GetComponent<Rigidbody>().useGravity && other.GetComponent<Food>().ignoreTriggerDelay<=0)
		{	
			if(Network.peerType == NetworkPeerType.Server)
			{
				Food f = other.GetComponent<Food>();
					
				if( other.GetComponent<Collider>()!=null && transform.parent.parent.GetComponent<Rigidbody>()!=null && other.GetComponent<PickupObject>().lastPlayerHolding!=null)
				{				
					transform.parent.parent.GetComponent<NetworkView>().RPC("AddFoodToBurger", RPCMode.AllBuffered, other.GetComponent<NetworkView>().viewID);

					// clamp rotation
					other.transform.rotation = Quaternion.Euler(Mathf.Clamp(other.transform.rotation.eulerAngles.x, -2.5f, 2.5f),
																other.transform.rotation.eulerAngles.y,
																Mathf.Clamp(other.transform.rotation.eulerAngles.z, -2.5f, 2.5f));
	
					// Snap food to centre of burger
					if(f.snapsToCentreInBurger)
					{
						other.transform.position = transform.position + other.transform.up * (other.transform.GetComponent<Collider>().bounds.size.y/3f); //2.6f
					}
					else
					{
						other.transform.position = new Vector3(
							Mathf.Clamp(other.transform.position.x, transform.position.x - transform.localScale.x/3, transform.position.x + transform.localScale.x/3),
							transform.position.y,
							Mathf.Clamp(other.transform.position.z, transform.position.z - transform.localScale.z/3, transform.position.z + transform.localScale.z/3));	
					}
					
					// inheret additional burger and parented food
					if(other.name.Contains("bun-bottom"))
					{
						transform.parent.parent.GetComponent<NetworkView>().RPC("MoveFoodFromBurger", RPCMode.AllBuffered, other.GetComponent<NetworkView>().viewID);
					}
					
					if(other.name.Contains("rat"))
					{
						other.GetComponent<Rat>().enabled = false;	
					}

					f.inFood = true;
					
					// Network syncing / cleanup
					other.GetComponent<NetworkView>().RPC("SetObjectPosition", RPCMode.All, other.transform.position, other.transform.rotation, other.GetComponent<NetworkView>().viewID);
					other.GetComponent<NetworkView>().RPC("SetParent", RPCMode.All, other.GetComponent<NetworkView>().viewID, transform.parent.parent.GetComponent<NetworkView>().viewID, "burger");
					other.GetComponent<NetworkView>().RPC("DestroyRigidbody", RPCMode.All, other.GetComponent<NetworkView>().viewID);
					other.GetComponent<NetworkView>().RPC("SetActive", RPCMode.All, other.GetComponent<NetworkView>().viewID, false);
					other.GetComponent<NetworkView>().RPC("SetObservedToTransform", RPCMode.All, other.GetComponent<NetworkView>().viewID);
					
					// Flag for new trigger positioning
					if(GetComponent<Collider>().enabled) lateUpdateRequired = true;			
					
					checkCount = 0;
				}
				
				if(foodCount(Food.FoodType.topBun)>0)
				{
					this.GetComponent<Collider>().enabled = false;	
					this.enabled = false;
				}
			}
			else
			{
				Food f = other.GetComponent<Food>();
				// just snap the food and assume everything is ok
				
				// Snap food to centre of burger
				if(f.snapsToCentreInBurger)
				{
					other.transform.position = transform.position + other.transform.up * (other.transform.GetComponent<Collider>().bounds.size.y/3f); //2.6f
				}
				else
				{
					other.transform.position = new Vector3(
						Mathf.Clamp(other.transform.position.x, transform.position.x - transform.localScale.x/3, transform.position.x + transform.localScale.x/3),
						transform.position.y,
						Mathf.Clamp(other.transform.position.z, transform.position.z - transform.localScale.z/3, transform.position.z + transform.localScale.z/3));	
				}
			}
		}
	}
	
	public int foodCount(Food.FoodType type)
	{
		int r=0;
		
		foreach (Food f in foodOnBurger)
		{
			if(f.type == type) r++;
		}
		return r;			
	}
}