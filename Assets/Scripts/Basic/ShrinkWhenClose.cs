using UnityEngine;
using System.Collections;

public class ShrinkWhenClose : MonoBehaviour {
	
	Vector3 startScale;
	
	// Use this for initialization
	void Start () {
	
			startScale = transform.localScale;
	}
	
	// Update is called once per frame
	void Update () {
		if((Camera.main.transform.position - transform.position).magnitude<10F)
		{
			transform.localScale = startScale * ((Camera.main.transform.position - transform.position).magnitude / 10);
		}
		else
		{
			transform.localScale = startScale;	
		}
	}
}
