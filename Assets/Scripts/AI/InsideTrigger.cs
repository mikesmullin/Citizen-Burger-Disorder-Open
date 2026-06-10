using UnityEngine;
using System.Collections;

public class InsideTrigger : MonoBehaviour {

	void OnTriggerEnter(Collider other)
	{	
		if(other.tag.Equals("NPC"))
		{
			other.GetComponent<NPC>().inside = true;
		}
	}
	
	void OnTriggerExit(Collider other)
	{	
		if(other.tag.Equals("NPC"))
		{
			other.GetComponent<NPC>().inside = false;
		}
	}
}
