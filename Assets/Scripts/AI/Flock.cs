using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Flock : MonoBehaviour {

	public int flockSize = 10;
	float spawnRange = 20;
	public GameObject boidPrefab;
	
	List<GameObject> flock;
	
	int villagersSpawned = 0;
	
	int recordedTotalHouses = 0;
	
	// Use this for initialization
	void Start () {
		InitFlock();
	}
	
	void InitFlock()
	{
		flock = new List<GameObject>();
		for(int i=0;i<flockSize;i++)
		{
			GameObject boid = Instantiate(boidPrefab, transform.position, transform.rotation) as GameObject;
			//boid.transform.parent = transform;
			
			// Set boid position proper
			Vector3 newPos = new Vector3(Random.insideUnitCircle.x, 0, Random.insideUnitCircle.y) + GetComponent<Collider>().bounds.size;
			Vector3 position = new Vector3(newPos.x + Random.Range(-spawnRange,spawnRange), 0, newPos.y + Random.Range(-spawnRange,spawnRange));
			boid.transform.localPosition = position;
			flock.Add(boid);
			villagersSpawned++;
		//	boid.GetComponent<FlockingBehaviourRedux>().villagerID = villagersSpawned;
		}
	}
	
	public void NewBoid()
	{
		GameObject boid = Instantiate(boidPrefab, transform.position, transform.rotation) as GameObject;
		//boid.transform.parent = transform;
		
		// Set boid position proper
		Vector3 newPos = new Vector3(Random.insideUnitCircle.x, 0, Random.insideUnitCircle.y) + GetComponent<Collider>().bounds.size;
		Vector3 position = new Vector3(newPos.x + Random.Range(-spawnRange,spawnRange), 0, newPos.y + Random.Range(-spawnRange,spawnRange));
		boid.transform.localPosition = position;
		flock.Add(boid);	
		villagersSpawned++;
		
		//boid.GetComponent<FlockingBehaviourRedux>().StartFlocking(flock);
		//boid.GetComponent<FlockingBehaviourRedux>().villagerID = villagersSpawned;
		
		flockSize++;
	}
	
	// Update is called once per frame
	void Update ()
	{
	}
}
