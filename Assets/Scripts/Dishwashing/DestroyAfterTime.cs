using UnityEngine;
using System.Collections;

public class DestroyAfterTime : MonoBehaviour {
	
	public float existForDuration = 4f;
	float initTime;
	
	
	// Use this for initialization
	void Start ()
	{
		initTime = Time.time;
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Time.time > initTime + existForDuration)
		{
			GameObject.Destroy(this.gameObject);
		}
	}
}
