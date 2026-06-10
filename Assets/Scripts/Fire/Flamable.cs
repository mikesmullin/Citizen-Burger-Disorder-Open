using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Flamable : MonoBehaviour {

	public static List<Flamable> AllFires = new List<Flamable>();
	public List<Flamable> NearFlamables = new List<Flamable>();
	Collider[] proximityBigFires;
	Collider[] proximityFlamables;
	Vector3 lastCheckLocation;

	public bool DEBUGsetOnFire = false;
	public bool isOnFire = false;
	public Vector3 fireOffsetLocaiton = Vector3.zero;
	public bool wasOnFire = false;
	public bool isFlamableAgain = true;

	public bool reflamable = false;
	public float burnHealth = 20; // seconds until 0 that this object can be near fire until catching on fire.
	public float burnoutAtHealth = -300;
	public float currentBurnHealth;
	public float tempUntilIgniteFire = 100;
	public float startTemp = 10f;
	public float currentTemp = 0;
	float fireSpreadRadius = 3f;

	Food food;
	public PickupObject pickup;

	GameObject FireGameObject;
	public FireAnimate fireAnimate;
	static GameObject firePrefab;

	public static FireWatch fireWatch;

	public bool nearBigFire = false;
	public float currentFireCheckRate;
	public float minFireCheckRate = 0.9f;
	public float maxFireCheckRate = 2f;

	// Use this for initialization
	void Start ()
	{
		if(GameObject.Find("!FireWatch")) fireWatch = GameObject.Find("!FireWatch").GetComponent<FireWatch>();

		if(GetComponent<Food>())
		{
			food = GetComponent<Food>();
		}

		if(GetComponent<PickupObject>())
		{
			pickup = GetComponent<PickupObject>();
		}

		firePrefab = Resources.Load("Prefabs/Fire/Fire") as GameObject;

		if(food)
		{
			startTemp = food.foodTemp;
		}

		currentTemp = startTemp;
		currentBurnHealth = burnHealth;

		currentFireCheckRate = maxFireCheckRate;
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Network.isServer)
		{
			if(DEBUGsetOnFire)
			{
				FireIgnite();
				DEBUGsetOnFire = false;
			}

			if(food)
			{
				currentTemp = food.foodTemp;
			}

			if(!isOnFire)
			{
				if(wasOnFire && reflamable && !isFlamableAgain)
				{
					currentBurnHealth = Mathf.Lerp(currentBurnHealth, burnHealth, Time.deltaTime * 0.5f);

					if(currentBurnHealth == burnHealth)
					{
						isFlamableAgain = true;
					}
				}


				if(!wasOnFire || (reflamable && isFlamableAgain))
				{
					// Test if the tempreture is too high
					if(currentTemp>tempUntilIgniteFire)
					{
						FireIgnite();
					}

					// Test if the object has caught fire from other objects
					if(currentBurnHealth<0)
					{
						FireIgnite();
					}
				}
			}

			if(isOnFire && currentBurnHealth <= burnoutAtHealth || currentTemp < startTemp)
			{
				//print (currentBurnHealth + " <= " + burnoutAtHealth + " || " + currentTemp + " < " + startTemp);
				FireBurnOut();
			}

			if(isOnFire)
			{
				currentBurnHealth -= Time.deltaTime;
				if(food!=null) food.cook();
			}
		}
	}

	IEnumerator FireDetect()
	{
		while(isOnFire)
		{
			if(lastCheckLocation == Vector3.zero || (lastCheckLocation - transform.position).magnitude > fireSpreadRadius)
			{
				NearFlamables.Clear();

				proximityFlamables = Physics.OverlapSphere(transform.position, fireSpreadRadius);

				foreach(Collider c in proximityFlamables)
				{
					if(c.GetComponent<Flamable>())
					{
						 NearFlamables.Add(c.GetComponent<Flamable>());
					}
				}
			}

			yield return new WaitForSeconds(0.4f);
		}
	}

	IEnumerator FireSpread()
	{
		while(isOnFire)
		{
			Vector3 avgPos = Vector3.zero;
			int localFireCount = 0;
			for(int i=0; i<NearFlamables.Count; i++)
			{
				if(NearFlamables[i].isOnFire && NearFlamables[i]!=this)
				{
					localFireCount++;
				}
				else if(!NearFlamables[i].isOnFire && NearFlamables[i]!=this)
				{
					NearFlamables[i].currentBurnHealth--;
				}

				avgPos += NearFlamables[i].transform.position;
			}

			avgPos /= NearFlamables.Count;

			Debug.DrawLine(transform.position, avgPos, Color.green, 2f);

			if(!nearBigFire && localFireCount > 3 && !CheckNearBigFire())
			{
				int layermask = ~(1<<LayerMask.NameToLayer("Food") | 1<<LayerMask.NameToLayer("Fire"));

				RaycastHit hit;
				if(Physics.Raycast(avgPos + Vector3.up, Vector3.down, out hit, 2f, layermask))
				{
					print ("Hit: " + hit.transform.name);

					if(Network.isServer)
					{
						// Create big fire
						fireWatch.GetComponent<NetworkView>().RPC("CreateBigFireAnimate", RPCMode.All, hit.point + new Vector3(0, Random.Range(-0.5f, 0.5f) + 1, 0), transform.rotation, Network.AllocateViewID());
					}
				}
			}

			yield return new WaitForSeconds(Random.Range (0.8f, 1.2f));
		}
	}

	IEnumerator LoopCheckNearBigFire()
	{
		while(isOnFire)
		{
			CheckNearBigFire();

			yield return new WaitForSeconds(Random.Range(3f, 8f));
		}
	}

	bool CheckNearBigFire()
	{
		if(!nearBigFire || (nearBigFire && (lastCheckLocation - transform.position).magnitude > fireSpreadRadius))
		{
			proximityBigFires = Physics.OverlapSphere(transform.position, fireSpreadRadius * 1f);
			bool testNearBigFire = false;

			foreach(Collider c in proximityBigFires)
			{
				if(c.GetComponent<FireAnimate>())
				{
					if(c.GetComponent<FireAnimate>().isLargeFire)
					{
						testNearBigFire = true;
					}
				}
			}

			nearBigFire = testNearBigFire;
		}

		return nearBigFire;
	}

	public void FireIgnite()
	{
		if(Network.isServer)
		{
			if(currentBurnHealth>=0) currentBurnHealth = -1;

			isOnFire = true;
			StartCoroutine(FireSpread());
			StartCoroutine(FireDetect());
			StartCoroutine(LoopCheckNearBigFire());

			fireWatch.GetComponent<NetworkView>().RPC("CreateFireAnimate", RPCMode.All, transform.position + fireOffsetLocaiton, transform.rotation, false, this.GetComponent<NetworkView>().viewID, Network.AllocateViewID());

			currentFireCheckRate = minFireCheckRate;
			AllFires.Add(this);

			fireWatch.GetComponent<NetworkView>().RPC("SyncAllFlamable", RPCMode.Others, GetComponent<NetworkView>().viewID, isOnFire, wasOnFire, isFlamableAgain, reflamable,
			                currentBurnHealth, currentTemp, nearBigFire, currentFireCheckRate);
		}
	}
	
	public void FireBurnOut(bool resetBurnTemp=false)
	{
		if(Network.isServer)
		{
			isOnFire = false;
			wasOnFire = true;
			isFlamableAgain = false; // for a small amount of time
			
			StopCoroutine(FireSpread());
			StopCoroutine(FireDetect());
			StopCoroutine(LoopCheckNearBigFire());
			
			if(fireAnimate) fireAnimate.PutOut(true);
			GameObject.Destroy(FireGameObject);
			FireGameObject = null;
			
			currentFireCheckRate = maxFireCheckRate;

			if(resetBurnTemp)
			{
				currentBurnHealth = burnHealth;
				currentTemp = startTemp;

				if(food!=null)
				{
					food.foodTemp = startTemp;
					food.CallSyncFood();
				}
			}
			
			AllFires.Remove(this);

			fireWatch.GetComponent<NetworkView>().RPC("SyncAllFlamable", RPCMode.Others, GetComponent<NetworkView>().viewID, isOnFire, wasOnFire, isFlamableAgain, reflamable,
			                currentBurnHealth, currentTemp, nearBigFire, currentFireCheckRate);
		}
	}
}
