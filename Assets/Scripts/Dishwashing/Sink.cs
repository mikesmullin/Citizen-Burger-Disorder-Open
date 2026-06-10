using UnityEngine;
using System.Collections;

public class Sink : MonoBehaviour {
	
	GameObject bubbles;
	float speed = 0.1f;

	float checkrate = 0.5f;
	float lastCheckTime = 0;
	
	void OnTriggerEnter(Collider other)
	{
		GameObject.Instantiate(bubbles, other.transform.position, other.transform.rotation);

		if(Network.isServer)
		{
			if(other.name.Contains("rat"))
			{
				other.GetComponent<Rat>().GetComponent<NetworkView>().RPC("GiveUp", RPCMode.All, GetComponent<NetworkView>().viewID);
				other.GetComponent<Rat>().enabled = false;	
			}

			if(other.GetComponent<Flamable>())
			{
				other.GetComponent<Flamable>().FireBurnOut();
			}
		}
	}
	
    void OnTriggerStay(Collider other)
	{
		if(Time.time > lastCheckTime + lastCheckTime)
		{
			if(other.tag.Equals("Physics"))
			{
				if(other.GetComponent<Renderer>().material.name.Contains("plate"))
				{
					float plateClean = other.GetComponent<Renderer>().material.GetFloat("_Blend");

					if(plateClean > 0.1f)
					{
						other.GetComponent<Renderer>().material.SetFloat("_Blend", Mathf.Max(0, plateClean - (Time.deltaTime * speed)));
					}
				}
			}

			lastCheckTime = Time.time;
		}
    }
	
	void OnTriggerExit(Collider other)
	{
		if(other.GetComponent<Renderer>()!=null && other.GetComponent<Renderer>().material.name.Contains("StaffMenuTex"))
		{
			other.GetComponent<DrawTexture>().NewTex();
		}	
	}
	
	// Use this for initialization
	void Start ()
	{
		bubbles = Resources.Load("Prefabs/Dishwashing/Bubbles") as GameObject;
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
