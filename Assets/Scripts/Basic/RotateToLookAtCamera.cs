using UnityEngine;
using System.Collections;

public class RotateToLookAtCamera : MonoBehaviour
{
	public float YFlip = -180;
	public float XFlip = 0;

	// Use this for initialization
	void Start () {
	
	}
	
	// Update is called once per frame
	void LateUpdate () {
		if(GetComponent<Renderer>().isVisible)
		{
			transform.LookAt(Camera.main.transform);
			transform.rotation = Quaternion.Euler(transform.rotation.eulerAngles.x + XFlip, transform.rotation.eulerAngles.y + YFlip, transform.rotation.eulerAngles.z);
		}
	}
}
