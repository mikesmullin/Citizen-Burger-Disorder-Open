using UnityEngine;
using System.Collections;

public class NumberStandTrigger : MonoBehaviour {

	float triggerDetectDelay = 4f;
	float triggerDetectStart = 0;

	// Use this for initialization
	void Start ()
	{
		
	}
	
	// Update is called once per frame
	void Update ()
	{
		
	}

	void OnTriggerEnter(Collider other)
	{
		if(Network.isServer)
		{
			if(Time.time > triggerDetectStart + triggerDetectDelay)
			{
				if(other.transform.GetComponent<Rigidbody>() &&
				   other.transform.GetComponent<Rigidbody>().useGravity && other.transform.GetComponentInChildren<NumberStand>())
				{
					if(ElementCreateOrderOverview.OrderCreateComputer.npcInQueue)
					{
						NPC n =	ElementCreateOrderOverview.OrderCreateComputer.npcInQueue;

						if(n.currentlyWants == NPC.wants.toGetNumberStand)
						{
							n.GiveNumberStand(other.transform.GetComponentInChildren<NumberStand>().numberStandNumber, other.transform.gameObject);
						}

						triggerDetectStart = Time.time;
					}
				}
			}
		}
	}
}
