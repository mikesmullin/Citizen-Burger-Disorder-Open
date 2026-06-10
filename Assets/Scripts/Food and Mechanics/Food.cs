using UnityEngine;
using System.Collections;

public class Food : MonoBehaviour
{
	public enum FoodType 
	{
		physics = 0,
		patty,
		potato,
		topBun,
		bun,
		lettuce,
		cheese,
		tomato,
		bacon,
		pineapple,
		rat,
		other
	}
	public FoodType type = FoodType.physics;
	
	BurgerStacking burgerStack;
	
	// checks to see what helped cook the food
	bool ovenCooked = false;
	bool grillCooked = false;
	
	public float cooked = 0; // range from 0.0 - 1.0
	float cookedDelay = 0; // range
	public float overcooked = 0; // range
	public float cookTimeIdeal = 10;
	public float cookTimeBurnDelay = 10;
	public float cookTimeBurned = 10;

	public float foodTemp = 20f;
	float startFoodTemp;
	float maxFoodTemp = 120f;
	float minFoodTemp = -20f;

	public bool supportsTextureBlend = false;
	
	Color highlightColor;
	Color originalColor;
	public float textureToKeep = 0.5f;
	public float cookedRed = 0.2F;
	public float cookedGreen = 0.0F;
	public float cookedBlue = 0.0F;

	public float cookSpeedModifier = 1; // set by cooking instrument
	
	public bool inFood = false;
	
	public bool snapsToCentreInBurger = true;
	
	public float ignoreTriggerDelay=0;
	
	public bool foodBeenOnFloor = false;
	public Rat beingHeldByRat;

	void OnPlayerConnected(NetworkPlayer player)
	{
		GetComponent<NetworkView>().RPC("SyncAllFood", player, GetComponent<NetworkView>().viewID, cooked, cookedDelay, overcooked, cookedRed, cookedBlue, cookedGreen, foodTemp, foodBeenOnFloor);
	}

	public void CallSyncFood()
	{
		if(Network.isServer)
			GetComponent<NetworkView>().RPC("SyncAllFood", RPCMode.Others, GetComponent<NetworkView>().viewID, cooked, cookedDelay, overcooked, cookedRed, cookedBlue, cookedGreen, foodTemp, foodBeenOnFloor);
	}

	[RPC]
	void SyncAllFood(NetworkViewID objectID, float nCooked, float nCookedDelay, float nOvercooked, float nRed, float nBlue, float nGreen, float nFoodTemp, bool nFoodBeenOnFloor)
	{
		Food f;

		try
		{
			f = NetworkView.Find(objectID).GetComponent<Food>();
		}
		catch (UnityException e) { Debug.Log(e); return; }

		f.cooked = nCooked;
		f.cookedDelay = nCookedDelay;
		f.overcooked = nOvercooked;
		f.foodTemp = nFoodTemp;
		f.foodBeenOnFloor = nFoodBeenOnFloor;

		f.cookedRed = nRed;
		f.cookedBlue = nBlue;
		f.cookedGreen = nGreen;

		f.UpdateMaterial(true);
	}

	void Awake()
	{
		if(GetComponent<Renderer>()!=null && GetComponent<Renderer>().material != null)
		{
			originalColor = GetComponent<Renderer>().material.color;
			
			GetComponent<Renderer>().material.color = Color.Lerp(originalColor, new Color(cookedRed, cookedGreen, cookedBlue), (cooked * cookSpeedModifier) * (1 - textureToKeep));	
		}
		
		burgerStack = GetBurgerStack();
		startFoodTemp = foodTemp;
	}
	
	public BurgerStacking GetBurgerStack()
	{
		if(burgerStack==null)
		{
			if(type == FoodType.bun && transform.FindChild("burger-bottom").GetChild(0))
			{
				burgerStack = transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>();
			}
			else if(type != FoodType.bun && inFood)
			{
				print ("Set burger stacking for " + transform.name);
				
				burgerStack = transform.parent.FindChild("triggerBunStack").GetComponent<BurgerStacking>();
			}
		}
		
		return burgerStack;
	}

	public void Highlight(Color highlightColor)
	{
		if(this.GetComponent<Renderer>()!=null && this.GetComponent<Renderer>().material!=null)
		{
			this.GetComponent<Renderer>().material.color = highlightColor;
		}
	}	
	
	public void cook()
	{
		foodTemp += Time.deltaTime;

		UpdateMaterial();
	}

	void UpdateMaterial(bool instant=false)
	{
		if(GetComponent<Renderer>())
		{
			if(!instant)
			{
				if(cooked < 1)
				{
					if(!supportsTextureBlend) GetComponent<Renderer>().material.color = Color.Lerp(originalColor, new Color(cookedRed, cookedGreen, cookedBlue), cooked);
					else
					{
						GetComponent<Renderer>().material.SetFloat("_Blend", cooked);
					}
					cooked += Time.deltaTime / cookTimeIdeal;
				}
				else if(cookedDelay < 1)
				{
					cookedDelay += Time.deltaTime / cookTimeBurnDelay;	
				}
				else if(overcooked < 1)
				{
					GetComponent<Renderer>().material.color = Color.Lerp(GetComponent<Renderer>().material.color, new Color(0.005F, 0F, 0F), (overcooked * cookSpeedModifier) / 80);
					overcooked += Time.deltaTime / cookTimeBurned;
				}
			}
			else
			{
				GetComponent<Renderer>().material.color = Color.Lerp(originalColor, new Color(cookedRed, cookedGreen, cookedBlue), cooked);
				GetComponent<Renderer>().material.color = Color.Lerp(GetComponent<Renderer>().material.color, new Color(0.005F, 0F, 0F), (overcooked * cookSpeedModifier) / 80);
			}
		}
	}

	[RPC]
	void MoveFoodFromBurger(NetworkViewID otherBurgerTransformID)
	{
		Transform target = NetworkView.Find(otherBurgerTransformID).transform;
		Transform trigger = target.transform.FindChild("burger-bottom").FindChild("triggerBunStack");
		
		burgerStack.foodOnBurger.AddRange(trigger.GetComponent<BurgerStacking>().foodOnBurger);
		burgerStack.transform.position = trigger.position;
		trigger.GetComponent<Collider>().enabled = false;
		trigger.GetComponent<BurgerStacking>().enabled = false;
		trigger.GetComponent<BurgerStacking>().foodOnBurger.Clear();
	}
	
	[RPC]
	void AddFoodToBurger(NetworkViewID foodTransformID)
	{
		Transform target = NetworkView.Find(foodTransformID).transform;
		Food foodToAdd = target.GetComponent<Food>();
		
		burgerStack.foodOnBurger.Add(foodToAdd);
	}
	
	[RPC]
	void AddFoodToPlate(NetworkViewID foodTransformID, NetworkViewID plateTransformID)
	{
		Transform target = NetworkView.Find(foodTransformID).transform;
		Plate trigger = NetworkView.Find(plateTransformID).transform.FindChild("triggerPlate").GetComponent<Plate>();
		
		trigger.foodOnPlate.Add(target.GetComponent<Food>());
	}
	
	[RPC]
	void SetObservedToNetObj(NetworkViewID id)
	{
		print ("WHY IS THIS BEING CALLED? REMOVE IT?");

		Transform target = NetworkView.Find(id).transform;
		
		if(GetComponent<PickupObject>())
		{
			target.GetComponent<PickupObject>().netObject.states = new NetworkObject.State[20];
			target.GetComponent<NetworkView>().observed = target.GetComponent<NetworkObject>();
		}
		else target.GetComponent<NetworkView>().observed = target.GetComponent<NetworkObject>();
	}
	
	[RPC]
	void SetCollider(bool state)
	{
		GetComponent<Collider>().enabled = state;
	}

	public bool getGrillCooked()
	{
		return grillCooked;	
	}
	
	public bool getOvenCooked()
	{
		return ovenCooked;	
	}
	
	public float getCooked()
	{
		return cooked;	
	}
	
	public float getOvercooked()
	{
		return overcooked;	
	}
	
	public void setCookingSpeedModifier(float f)
	{
		cookSpeedModifier = f;	
	}
	
	public void setOvenCooked(bool b)
	{
		ovenCooked = b;	
	}
	
	public void setGrillCooked(bool b)
	{
		grillCooked = b;	
	}
	
	
	void Update()
	{
		if(ignoreTriggerDelay>0)
		{
			ignoreTriggerDelay = Mathf.Max(0, ignoreTriggerDelay - Time.deltaTime);
		}

		foodTemp = Mathf.Lerp(foodTemp, startFoodTemp, 0.01f * Time.deltaTime);
	}
	
	[RPC]
	public void BurgerExplosion(float force, NetworkViewID targetID)
	{
		Transform target = NetworkView.Find(targetID).transform;
		Food targetFood = target.GetComponent<Food>();
		
		print ("Getting burger stack for " + target.name + " with " + burgerStack.foodOnBurger.Count + " items");
		
		int childCound = burgerStack.foodOnBurger.Count;
		
		for(int i=childCound-1; i>=0; i--)		
		{
			print (burgerStack.foodOnBurger[i].transform.name + " is exploding " + i);
			
			Transform t = burgerStack.foodOnBurger[i].transform;
			
			if(t.tag.Contains("Food"))
			{
				if(GetComponent<NetworkView>().isMine)
				{
					GetComponent<NetworkView>().RPC("SetActive", RPCMode.All, t.GetComponent<NetworkView>().viewID, true);
					GetComponent<NetworkView>().RPC("SetObservedToNetObj", RPCMode.All, t.GetComponent<NetworkView>().viewID);
					
					if(t.GetComponent<Food>().type == FoodType.bun && i>0)
					{
						GetComponent<NetworkView>().RPC("BurgerExplosion", RPCMode.All,	force, t.GetComponent<NetworkView>().viewID);
					}
				}
				
				if(t.name.Contains("rat"))
				{
					t.GetComponent<Rat>().enabled = true;
				}
				
				t.parent = null;
				t.GetComponent<Food>().ignoreTriggerDelay = 1f;
				
				if(!t.GetComponent<Rigidbody>())
				{
					t.gameObject.AddComponent<Rigidbody>();
					if(GetComponent<NetworkView>().isMine) t.GetComponent<Rigidbody>().AddExplosionForce((i/(Mathf.Max(childCound-1, 1))) * force, t.position, targetFood.burgerStack.foodOnBurger.Count);
				}
			}
		}
		
		targetFood.burgerStack.foodOnBurger.Clear();
		
		burgerStack.enabled = true;
		burgerStack.Reset();
	}
	
	void OnCollisionEnter (Collision collision)
	{
		if(type == FoodType.bun && Network.isServer && GetComponent<Rigidbody>())
		{
			if(burgerStack.foodOnBurger.Count>0 && collision.relativeVelocity.magnitude > 7f)
			{
				//networkView.RPC("BurgerExplosion", RPCMode.All,	60f, this.networkView.viewID); 				
			}
		}
	}
}
