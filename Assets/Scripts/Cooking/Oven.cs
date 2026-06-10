using UnityEngine;
using System.Collections;

public class Oven : MonoBehaviour {
	
	public AudioClip sfxOvenCooking;
	
	void OnTriggerEnter(Collider other)
	{
		if(sfxOvenCooking!=null) AudioSource.PlayClipAtPoint(sfxOvenCooking, transform.position);
	}
	
    void OnTriggerStay(Collider other)
	{
		Food f;
		if(other.GetComponent<Food>())
		{
			f = other.GetComponent<Food>();
			f.cook();
			
			if(f.cookSpeedModifier != 0.5F) f.cookSpeedModifier = 0.5F;
		}
    }
}
