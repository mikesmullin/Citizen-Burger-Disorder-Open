using UnityEngine;
using System.Collections;

public class LightBulb : MonoBehaviour {

	Light bulb;
	float startIntensity;
	float goalIntensity;
	bool turning = false;
	bool on = false;

	float speed = 15f;

	// Use this for initialization
	void Awake ()
	{
		bulb = GetComponent<Light>();

		startIntensity = bulb.intensity;
		goalIntensity = startIntensity;

		Toggle(on);
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(bulb.intensity!=goalIntensity)
			bulb.intensity = Mathf.Lerp(bulb.intensity, goalIntensity, speed * Time.deltaTime);
	}

	public void Toggle(bool state)
	{
		//print ("turning light " + state);

		if(state) bulb.enabled = state;

		if(state)
		{
			goalIntensity = startIntensity;
		}
		else
		{
			goalIntensity = 0;
		}
	}
}
