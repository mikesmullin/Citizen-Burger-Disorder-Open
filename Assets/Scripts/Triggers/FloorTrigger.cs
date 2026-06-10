using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class FloorTrigger : MonoBehaviour {
	
	int maxRatSpawns = 5;
	public static int currentRats;
	
	Object ratPrefab;
	Transform ratSpawn;
	
	float ratSpawnStartTimer = 0;
	float ratTimerUntilSpawn = 30;
	
	float ratSpawnCooldown = 10;
	float ratSpawnCooldownStart = 0;

	public static List<GameObject> foodDropPosition = new List<GameObject>();
	
	// Use this for initialization
	void Start ()
	{
		ratSpawn = GameObject.Find("!RatGraph").transform.FindChild("RATSPAWN");
		ratPrefab = Resources.Load("Prefabs/NPC/rat");
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Network.isServer && currentRats<maxRatSpawns && Time.time > ratSpawnCooldown + ratSpawnCooldownStart)
		{
			if(Time.time > ratSpawnStartTimer + ratTimerUntilSpawn && foodDropPosition.Count>0)
			{
				Vector3 goalPosition;

				// spawn a bunch of rats
				for(int i=0; i<Mathf.Min(foodDropPosition.Count, 3); i++)
				{
					if(currentRats > maxRatSpawns) break;

					// pick a random positionn for the rat to go to
					if(foodDropPosition.Count == 0) goalPosition = ratSpawn.transform.position;
					else
					{
						int randPos = Random.Range(0, foodDropPosition.Count-1);
						goalPosition = foodDropPosition[randPos].transform.position;
					}
					
					Rat newRat = (Network.Instantiate(ratPrefab, ratSpawn.transform.position, Quaternion.identity, 3) as GameObject).GetComponent<Rat>();
					
					GetComponent<NetworkView>().RPC("SetRatTarget", RPCMode.AllBuffered, newRat.GetComponent<NetworkView>().viewID, goalPosition);
					currentRats++;
				}
				
				if(Random.value>0.1f)
				{
					ratSpawnCooldownStart = Time.time;
				}
			}
			else if(foodDropPosition.Count == 0)
			{
				ratSpawnStartTimer = Time.time;	
			}
		}
	}
	
	void OnTriggerEnter(Collider other)
	{
		if(Network.isServer && other.GetComponent<Food>() && !other.name.Contains("rat") && !foodDropPosition.Contains(other.gameObject))
		{
			other.GetComponent<Food>().foodBeenOnFloor = true;
			
			if(Network.isServer)
			{		
				foodDropPosition.Add(other.gameObject);
				ratSpawnStartTimer = Time.time;
			}
		}
	}
	
	void OnTriggerExit(Collider other)
	{
		if(Network.isServer && other.GetComponent<Food>() && !other.name.Contains("rat") && foodDropPosition.Contains(other.gameObject))
		{
			foodDropPosition.Remove(other.gameObject);
		}
	}
	
	[RPC]
	void SetRatTarget(NetworkViewID ratID, Vector3 target)
	{
		Transform rat = NetworkView.Find(ratID).transform;
		Rat newRat = rat.GetComponent<Rat>();
		
		newRat.SetTargetFood(target);	
	}
}
