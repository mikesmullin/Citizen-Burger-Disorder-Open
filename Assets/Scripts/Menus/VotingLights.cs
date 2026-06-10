using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class VotingLights : MonoBehaviour {

	public LevelSelectCountdown lsc;
	public List<GameObject> lights = new List<GameObject>();

	// Use this for initialization
	void Start ()
	{
	
	}
	
	// Update is called once per frame
	void Update ()
	{
	
	}

	public void LightToPercent(float percent)
	{
		int count = lights.Count;
		int toLightUp = Mathf.RoundToInt(percent * count);

		for(int i=0; i<count; i++)
		{
			lights[i].GetComponent<Renderer>().material.color = Color.white;
		}

		for(int i=0; i<toLightUp; i++)
		{
			lights[i].GetComponent<Renderer>().material.color = Color.green;
		}

		if(percent>0.5f)
		{
			lsc.StartCountdown(transform.position + Vector3.up * 5);
		}
		else
		{
			lsc.StopCountdown();
		}
	}
}
