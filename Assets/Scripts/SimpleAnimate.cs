using UnityEngine;
using System.Collections;

public class SimpleAnimate : MonoBehaviour {

	public enum MovementType
	{
		Wave,
		Increment
	}
	public MovementType rotationType;

	public float rotateSpeed = 15f;
	public Vector3 rotateDirection = Vector3.zero;

	float sinValue = 1;

	// Use this for initialization
	void Start ()
	{
	
	}
	
	// Update is called once per frame
	void Update ()
	{
		transform.Rotate (rotateDirection * rotateSpeed * Time.deltaTime);

	}
}
