using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class LightSwitch : MonoBehaviour {

	public List<LightBulb> MyLights = new List<LightBulb>();

	public Transform switchyThing;

	Vector3 startRot;
	Vector3 goalRot;
	float switchZRotation = 45;
	float speed = 15;

	public bool on = true;

	// Use this for initialization
	void Start ()
	{
		startRot = switchyThing.transform.rotation.eulerAngles;
		SwitchSwitch(on);
	}
	
	// Update is called once per frame
	void LateUpdate ()
	{
		switchyThing.rotation = Quaternion.Lerp(switchyThing.rotation, Quaternion.Euler(goalRot), speed * Time.deltaTime);
	}

	void OnTriggerEnter(Collider other)
	{
		SwitchSwitch(!on);
	}

	void SwitchSwitch(bool state)
	{
		on = state;

		if(on)
		{
			goalRot = startRot + new Vector3(0,0,switchZRotation);
		}
		else
		{
			goalRot = startRot + new Vector3(0,0,-switchZRotation);
		}

		foreach(LightBulb light in MyLights)
		{
			light.Toggle(on);
		}
	}
}
