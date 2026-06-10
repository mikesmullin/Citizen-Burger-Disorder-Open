using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class LocalObjectDetection : MonoBehaviour {

	public List<GameObject> ObjectsToAvoid = new List<GameObject>();
	List<GameObject> ObjectsToRemove = new List<GameObject>();
	List<float> ObjectsToRemoveTime = new List<float>();
	float removeDelay = 0.5f;

	void OnTriggerEnter(Collider other)
	{
		if(Network.isServer)
		{
			if(!other.isTrigger && other.transform != transform.parent && !ObjectsToAvoid.Contains(other.gameObject))
			{
				if(transform.parent.GetComponent<NPC>().holding != other.gameObject)
					ObjectsToAvoid.Add(other.gameObject);
			}
		}
	}

	void OnTriggerExit(Collider other)
	{
		if(Network.isServer)
		{
			if(ObjectsToAvoid.Contains(other.gameObject))
			{
				ObjectsToRemove.Add(other.gameObject);
				ObjectsToRemoveTime.Add(Time.time);
			}
		}
	}

	// Use this for initialization
	void Start () {
	
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Network.isServer)
		{
			if(ObjectsToRemove.Count>0)
			{
				int index=0;
				while(ObjectsToRemove.Count>0 && index==0)
				{
					/*
					print ("Looking at " + index + " with time " + (ObjectsToRemoveTime[index]+removeDelay)
					       + " / " + Time.time);
					       */

					if(ObjectsToRemoveTime[index] + removeDelay < Time.time)
					{
						ObjectsToAvoid.Remove(ObjectsToRemove[index]);
						ObjectsToRemove.RemoveAt(index);
						ObjectsToRemoveTime.RemoveAt(index);
					}
					else
					{
						index++;
						break;
					}
				}
			}
		}
	}
}
