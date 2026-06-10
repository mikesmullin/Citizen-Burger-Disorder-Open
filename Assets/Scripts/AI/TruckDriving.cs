using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class TruckDriving : MonoBehaviour {

	TruckContents truckContents;

	public List<GameObject> truckGoals = new List<GameObject>();
	GameObject currentGoal;
	int currentIndex = 0;

	public bool reachedSTOP = false;

	Vector3 goalStartPos;
	Vector3 goalStartRot;

	float travelTimeBetweenNodes = 1.75f;
	float waitTimeDuration = 30f;
	float elapsedWaitTime = 0;
	float elapsedTime = 0;

	public GameObject boxPrefab;
	public int contents = 0; // meat, bread, produce, etc

	void Start ()
	{
		truckContents = transform.FindChild("TruckContentsTrigger").GetComponent<TruckContents>();

		FindGoals();

		goalStartPos = transform.position;
		goalStartRot = transform.rotation.eulerAngles;
		currentGoal = truckGoals[currentIndex];
	}

	// Update is called once per frame
	void Update ()
	{
		if(!reachedSTOP || (reachedSTOP && elapsedWaitTime >= waitTimeDuration))
		{
			if(currentGoal.name.Contains("STOP"))
			{
				TravelToGoal(3, 3);
			}
			else
			{
				TravelToGoal(0, 3);
			}
		}
		
		if(elapsedTime >= travelTimeBetweenNodes)
		{
			if(currentGoal.name.Contains("STOP"))
			{
				// time to leave!
				if(elapsedWaitTime >= waitTimeDuration)
				{
					if(Network.isServer) truckContents.DestroyBoxesInsideTruck();

					travelTimeBetweenNodes = 4f;

					currentIndex = (currentIndex + 1) % truckGoals.Count;
					currentGoal = truckGoals[currentIndex];
					goalStartPos = transform.position;
					goalStartRot = transform.rotation.eulerAngles;
					elapsedTime = 0;
				}

				// Just got here - spawn boxes and stuff!
				if(!reachedSTOP)
				{
					reachedSTOP = true;
				
					if(Network.isServer) SpawnBoxesInsideTruck();
				}

				elapsedWaitTime += Time.deltaTime;
			}
			else if(currentGoal.name.Contains("END"))
			{
				if(Network.isServer)
				{
					Network.RemoveRPCs(this.gameObject.GetComponent<NetworkView>().viewID);
					Network.Destroy(this.gameObject);
				}
			}
			else
			{
				// if(!reachedSTOP && Network.isServer) Boxes();

				currentIndex = (currentIndex + 1) % truckGoals.Count;
				currentGoal = truckGoals[currentIndex];
				goalStartPos = transform.position;
				goalStartRot = transform.rotation.eulerAngles;
				elapsedTime = 0;
			}
		}

		elapsedTime += Time.deltaTime;
	}

	void SpawnBoxesInsideTruck()
	{
		Vector3 centrePos = transform.position + (transform.up * 7.5f);
		Vector3 spawnPos;
		int maxSpawnCount = Random.Range(4, 9);
		int spawnCount = 0;
		
		// groups of boxes
		for(int i=0; i<2; i++)
		{
			// rows
			for(int j=0; j<6; j++)
			{
				// columns
				for(int k=0; k<2; k++)
				{
					if(spawnCount < maxSpawnCount && Random.value > 0.4f)
					{
						spawnPos = centrePos + (transform.right * 2.5f * j) + (-transform.forward*2.5f + (transform.forward * 5 * i) + (transform.up * 2.5f * k));

						GameObject newBox = Network.Instantiate(boxPrefab, spawnPos, transform.rotation * Quaternion.Euler(0, Random.Range(-20, 20), 0), 1) as GameObject;
						Box b = newBox.GetComponent<Box>();

						b.GetComponent<NetworkView>().RPC("SyncContents", RPCMode.AllBuffered, b.GetComponent<NetworkView>().viewID, contents);

						spawnCount++;
					}
					else break;
				}
			}
		}
	}

	void FindGoals()
	{
		GameObject[] goals = GameObject.FindGameObjectsWithTag("TruckGoal");

		int i, j;
		GameObject index;

		truckGoals.Clear();

		for(i = 1; i < goals.Length; i++)
		{
			index = goals[i];
			j = i;

			while( (j>0) && (GetDistance(goals[j-1]) > GetDistance(index)) )
			{
				goals[j] = goals[j-1];
				j = j - 1;
			}

			goals[j] = index;
		}

		for(i = 0; i<goals.Length; i++)
		{
			truckGoals.Add(goals[i]);
		}
	}

	float GetDistance(GameObject to)
	{
		return (transform.position - to.transform.position).magnitude;
	}
	
	void Boxes()
	{
		int amount = Random.Range(1, 3);

		print(amount);

		for(int i=0; i<amount; i++)
		{
			GameObject newBox = Network.Instantiate(boxPrefab, transform.position - (transform.forward * 1.6f) + transform.up * 10 + Random.insideUnitSphere * 2, transform.rotation * Quaternion.Euler(0, 270, 0), 1) as GameObject;
			newBox.GetComponent<Rigidbody>().AddForce((-transform.forward * 300) + (transform.up * 300) + Random.insideUnitSphere * 30);
		}
	}

	void TravelToGoal(int posLerpStyle = 0, int rotLerpStyle = 0)
	{
		Vector3 p = Vector3.zero;
		Vector3 r = Vector3.zero;

		Vector3 gPos = currentGoal.transform.position;
		Vector3 gRot = currentGoal.transform.rotation.eulerAngles;

		switch(posLerpStyle)
		{
		case 1:
			p.x = Sinerp(goalStartPos.x, gPos.x, (elapsedTime / travelTimeBetweenNodes));
			p.y = Sinerp(goalStartPos.y, gPos.y, (elapsedTime / travelTimeBetweenNodes));
			p.z = Sinerp(goalStartPos.z, gPos.z, (elapsedTime / travelTimeBetweenNodes));

			r.x = Sinerp(goalStartRot.x, gRot.x, (elapsedTime / travelTimeBetweenNodes));
			r.y = Sinerp(goalStartRot.y, gRot.y, (elapsedTime / travelTimeBetweenNodes));
			r.z = Sinerp(goalStartRot.z, gRot.z, (elapsedTime / travelTimeBetweenNodes));
			break;
		case 2:
			p.x = Coserp(goalStartPos.x, gPos.x, (elapsedTime / travelTimeBetweenNodes));
			p.y = Coserp(goalStartPos.y, gPos.y, (elapsedTime / travelTimeBetweenNodes));
			p.z = Coserp(goalStartPos.z, gPos.z, (elapsedTime / travelTimeBetweenNodes));

			r.x = Coserp(goalStartRot.x, gRot.x, (elapsedTime / travelTimeBetweenNodes));
			r.y = Coserp(goalStartRot.y, gRot.y, (elapsedTime / travelTimeBetweenNodes));
			r.z = Coserp(goalStartRot.z, gRot.z, (elapsedTime / travelTimeBetweenNodes));
			break;
		case 3:
			p.x = Berp(goalStartPos.x, gPos.x, (elapsedTime / travelTimeBetweenNodes));
			p.y = Berp(goalStartPos.y, gPos.y, (elapsedTime / travelTimeBetweenNodes));
			p.z = Berp(goalStartPos.z, gPos.z, (elapsedTime / travelTimeBetweenNodes));

			r.x = Berp(goalStartRot.x, gRot.x, (elapsedTime / travelTimeBetweenNodes));
			r.y = Berp(goalStartRot.y, gRot.y, (elapsedTime / travelTimeBetweenNodes));
			r.z = Berp(goalStartRot.z, gRot.z, (elapsedTime / travelTimeBetweenNodes));
			break;
		default:
			p.x = Mathf.Lerp(goalStartPos.x, gPos.x, (elapsedTime / travelTimeBetweenNodes));
			p.y = Mathf.Lerp(goalStartPos.y, gPos.y, (elapsedTime / travelTimeBetweenNodes));
			p.z = Mathf.Lerp(goalStartPos.z, gPos.z, (elapsedTime / travelTimeBetweenNodes));

			r.x = Mathf.Lerp(goalStartRot.x, gRot.x, (elapsedTime / travelTimeBetweenNodes));
			r.y = Mathf.Lerp(goalStartRot.y, gRot.y, (elapsedTime / travelTimeBetweenNodes));
			r.z = Mathf.Lerp(goalStartRot.z, gRot.z, (elapsedTime / travelTimeBetweenNodes));
			break;
		}

		transform.position = p;
		transform.rotation = Quaternion.Euler(r);
	}



	float Berp(float start, float end, float value)
	{
		value = Mathf.Clamp01(value);
		value = (Mathf.Sin(value * Mathf.PI * (0.2f + 2.5f * value * value * value)) * Mathf.Pow(1f - value, 2.2f) + value) * (1f + (1.2f * (1f - value)));
		return start + (end - start) * value;
	}

	float Sinerp(float start, float end, float value)
	{
		return Mathf.Lerp(start, end, Mathf.Sin(value * Mathf.PI * 0.5f));
	}

	float Coserp(float start, float end, float value)
	{
		return Mathf.Lerp(start, end, 1.0f - Mathf.Cos(value * Mathf.PI * 0.5f));
	}
}
