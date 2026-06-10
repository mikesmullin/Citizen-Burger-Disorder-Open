using UnityEngine;
using System.Collections;

public class Grill : MonoBehaviour {
	
	public AudioClip sfxMeatCooking;
	
	void OnTriggerEnter(Collider other)
	{
		if(sfxMeatCooking!=null && other.GetComponent<Food>()!=null) AudioSource.PlayClipAtPoint(sfxMeatCooking, other.transform.position);
	}
	
    void OnTriggerStay(Collider other)
	{
		Food f;
		if(other.GetComponent<Food>())
		{
			f = other.GetComponent<Food>();
			f.cook();
			
			if(f.cookSpeedModifier != 1) f.cookSpeedModifier = 1;
		}
    }
}
