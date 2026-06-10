using UnityEngine;
using System.Collections;

public class SpawnNPC : MonoBehaviour {
		
	// spawn management
	public static int currentNPCs = 0;
	int maxNPCs = 20;
	int maxRestaurantNPCs = 10;
	float spawnRadius = 6;
	
	// timers
	float spawnMinDelay = 100;
	float currentSpawnMinDelay;
	static float spawnAdditionalTimeRand = 0;
	float spawnMaxRand = 40;

	// time of day timer multipliers
	float[] timeOfDaySpawnMultipliers = new float[] { 0.5f, 1f, 1.2f, 0.5f, 2f, 0.9f, 1.5f, 1f }; // early, breakfast, mid day, lunch, afternoon, dinner, late
	
	static float lastSpawnTime = 0;

	float citizenSpawnDelay = 20;
	float lastCitizenSpawn = 0;

	void Start ()
	{
		spawnAdditionalTimeRand = 10; // the first npc spawn

		currentSpawnMinDelay = spawnMinDelay;

		lastSpawnTime = Time.time - currentSpawnMinDelay;
	}

	void OnGUI()
	{
		GUI.skin.label.fontSize = 12;
		GUI.Label(new Rect(0, 20, 500, 20),"Spawn: " + Mathf.Round((lastSpawnTime + currentSpawnMinDelay + spawnAdditionalTimeRand) - (Time.time)));
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Network.isServer)
		{
			if(TimeOfDay.currentTimeOfDay<TimeOfDay.endTimeOfDay)
			{
				int currentMultiplier = Mathf.RoundToInt(((TimeOfDay.currentTimeOfDay - TimeOfDay.startTimeOfDay) / (TimeOfDay.endTimeOfDay - TimeOfDay.startTimeOfDay)) * (timeOfDaySpawnMultipliers.Length-1));
				currentSpawnMinDelay = spawnMinDelay * (1/(timeOfDaySpawnMultipliers[currentMultiplier]+0.001f)) / Mathf.Max(Network.connections.Length+1,3);
			}

			// these npcs will never enter the restaurant
			if(Time.time > lastCitizenSpawn + citizenSpawnDelay)
			{
				lastCitizenSpawn = Time.time;

				if(Random.value > 0.999f) SpawnNewNPC(0, 1, 1);
				else SpawnNewNPC(0, 1, 0);
			}

			// npcs will sometimes spawn in groups, go into restaurant
			if(Time.time > lastSpawnTime + (currentSpawnMinDelay + spawnAdditionalTimeRand))
			{
				lastSpawnTime = Time.time;
				spawnAdditionalTimeRand = Random.Range(0, spawnMaxRand+1);
				
				if(currentNPCs < maxNPCs)
				{
					int npcWants = 0;
					int groupSize = 1;

					npcWants = 1;

					float randGroupSize = Random.value;

					if(randGroupSize > 0.9f)
					{
						groupSize = 3;
					}
					else if(randGroupSize > 0.7f)
					{
						groupSize = 4;
					}
					else if(randGroupSize > 0.2f)
					{
						groupSize = 2;
					}

					// no tables for group
					if(TableGraph.FindUnoccupiedTableForGroup(groupSize) == -1)
					{
						// don't bother waiting
						npcWants = 0;
					}



					for(int i=0; i<groupSize; i++)
					{
						SpawnNewNPC(npcWants, groupSize);
					}
				}
			}
		}
	}
	
	GameObject SpawnNewNPC(int npcWants = 0, int groupSize = 1, int easterEgg = 0)
	{

		Vector3 randomSpawnWithinBounds = transform.position + Random.insideUnitSphere * spawnRadius;		
		randomSpawnWithinBounds.y = transform.position.y;

		GameObject newNPC;
		newNPC = Network.Instantiate(Resources.Load("Prefabs/NPC/NPC"), randomSpawnWithinBounds, transform.rotation, 2) as GameObject;
		newNPC.GetComponent<NetworkView>().RPC("SetNPCTexture", RPCMode.AllBuffered, newNPC.GetComponent<NetworkView>().viewID, Random.Range(1,6+1) + "");	
	
		// easter egg spawns
		if(easterEgg == 1)
		{
			string[] specialNPCNames = new string[] { "jorji", "cookServe" };	
			newNPC.GetComponent<NetworkView>().RPC("SetNPCTexture", RPCMode.AllBuffered, newNPC.GetComponent<NetworkView>().viewID, specialNPCNames[Random.Range(0, specialNPCNames.Length)]);
		}
		
		newNPC.GetComponent<NetworkView>().RPC("setWants", RPCMode.All, npcWants);
		newNPC.GetComponent<NetworkView>().RPC("setGroupSize", RPCMode.All, newNPC.GetComponent<NetworkView>().viewID, groupSize);
		
		currentNPCs++;
		
		return newNPC;
	}
}
