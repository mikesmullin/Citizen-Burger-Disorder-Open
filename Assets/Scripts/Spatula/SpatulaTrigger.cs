using UnityEngine;
using System.Collections;

public class SpatulaTrigger : MonoBehaviour
{

	void OnTriggerEnter(Collider other)
	{
		if(Network.isServer && other.GetComponent<Rigidbody>())
		{
			if(other.tag.Contains("Physics"))
			{
				other.GetComponent<Rigidbody>().AddForce(transform.up * 900f - transform.forward * 500f);
			}
		}
	}

	// Use this for initialization
	void Start () {
	
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
