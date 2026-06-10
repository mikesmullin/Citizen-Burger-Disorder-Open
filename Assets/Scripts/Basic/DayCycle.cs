using UnityEngine;
using System.Collections;

public class DayCycle : MonoBehaviour {
	
	public float dayLengthInSeconds = 300;
	float rotationPerFrame;
	
	// Use this for initialization
	void Start () {
		rotationPerFrame = 360 / dayLengthInSeconds;
	}
	
	// Update is called once per frame
	void Update ()
	{
		transform.Rotate(new Vector3(rotationPerFrame * Time.deltaTime, 0, 0));
	}
}
