using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class TruckContents : MonoBehaviour {

	List<Collider> objectsInsideTruck = new List<Collider>();

	// Use this for initialization
	void Start () {
	
	}

	void OnTriggerEnter(Collider other)
	{
		if(other.tag.Contains("Physics"))
		{
			objectsInsideTruck.Add(other);
		}
	}

	void OnTriggerExit(Collider other)
	{
		if(objectsInsideTruck.Contains(other))
		{
			objectsInsideTruck.Remove(other);
		}
	}
	
	public void DestroyBoxesInsideTruck()
	{
		Collider[] colliderArray = objectsInsideTruck.ToArray();

		for(int i=0; i<colliderArray.Length; i++)
		{
			Collider c = colliderArray[i];

			if(c!=null)
			{
				print (c.name);

				if(c.tag.Contains("Physics"))
				{
					Debug.DrawLine(transform.position, c.transform.position, Color.blue, 40f);

					if(c.gameObject.GetComponent<PickupObject>().playerHolding==null)
					{
						c.GetComponent<PickupObject>().DestroyObject();
					}
				}
			}
		}

		objectsInsideTruck.Clear();
	}
}
