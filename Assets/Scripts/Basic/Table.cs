using UnityEngine;
using System.Collections.Generic;
using System.Collections;
using System;

public class Table : MonoBehaviour {

	public NPC npcAtTable;
	public TableNodes myTableNode;
	public Transform reward;
	public int tableNumber;

	void SpawnMoney(int maxMoney = 3)
	{
		int moneyToSpawn = UnityEngine.Random.Range(1, maxMoney+1);

		for(int i=0; i<=moneyToSpawn; i++)
		{
			Transform money = Network.Instantiate(reward, transform.position + transform.up * 1.5F, transform.rotation, 0) as Transform;

			money.GetComponent<Rigidbody>().AddForce(npcAtTable.transform.up * 700 + npcAtTable.transform.forward * 400 + UnityEngine.Random.insideUnitSphere * 2);
		}
	}
	
	void OnTriggerEnter(Collider other)
	{
		if(Network.isServer)
		{
			if(npcAtTable!=null && npcAtTable.currentlyWants == NPC.wants.toGetFood)
			{
				Plate p;
				if(other.transform.FindChild("triggerPlate") && other.transform.GetComponent<Rigidbody>() && other.transform.GetComponent<Rigidbody>().useGravity)
				{
					p = other.transform.FindChild("triggerPlate").GetComponent<Plate>();

					if(p.foodOnPlate.Count>0)
					{
						float moneyToSpawn = Menu.ScoreFood(npcAtTable.desiredFood, p.foodOnPlate[0]);
						moneyToSpawn = Mathf.Round(moneyToSpawn * 1.3f); // add profit
						moneyToSpawn = moneyToSpawn * 0.5f; // because each dollar is worth $2 for some reason

						if(UnityEngine.Random.value>0.8f) moneyToSpawn += 1; // sometimes tip

						SpawnMoney(Mathf.RoundToInt(moneyToSpawn));

						//npcAtTable.holding = p.foodBaseObject;
						GameObject foodToHold = p.foodBaseObject;
						p.DetachFoodFromPlate();
						npcAtTable.GetComponent<NetworkView>().RPC("Grab", RPCMode.All, foodToHold.GetComponent<NetworkView>().viewID, npcAtTable.GetComponent<NetworkView>().viewID);

						npcAtTable.DestroyAllSpeechBubbles();
						npcAtTable.SetWants((int)NPC.wants.toEat);
					}
				}
			}
		}
	}
}
