using UnityEngine;
using System.Collections;

public class newKeyboardButton : MonoBehaviour {
	
	bool pressed = false;
	float pressedFrame = 0;
	float pressedTime = 0;
	float pressedDuration = 0.4f;
	
	Vector3 startPos;
	Vector3 pressedPos;
	
	Color baseColour;
	public Color pressedColour;
	
	float currentYOffset = -1.5f;
	float YOffsetInc = 0.35f;

	public newMonitor ConnectedMonitor;
	
	public enum Direction
	{
		Up,
		Down,
		Left,
		Right
	}
	public Direction MyKey = Direction.Up;

	// Use this for initialization
	void Start () {
		if(!ConnectedMonitor) print ("ERROR: NO MONITOR CONNECTED TO BUTTONS!");

		startPos = transform.localPosition;
		pressedPos = startPos - transform.up * 0.4f;
		
		baseColour = GetComponent<Renderer>().material.color;
	//	pressedColour = Color.green;
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(pressedTime + pressedDuration < Time.time)
		{
			pressed=false;
		}
		
		if(pressed)
		{
			transform.localPosition = Vector3.Lerp(transform.localPosition, pressedPos, 10 * Time.deltaTime);
			GetComponent<Renderer>().material.color = Color.Lerp(GetComponent<Renderer>().material.color, pressedColour, 10*Time.deltaTime);
		}
		else if((transform.localPosition - startPos).magnitude > 0.1f)
		{
			transform.localPosition = Vector3.Lerp(transform.localPosition, startPos, 10 * Time.deltaTime);
			GetComponent<Renderer>().material.color = Color.Lerp(GetComponent<Renderer>().material.color, baseColour, 10*Time.deltaTime);
		}
	}

	void OnTriggerStay(Collider other)
	{
		if(!pressed && other.transform!=transform.parent)
		{
//			print (other.transform.name + ", " + transform.parent.name);

			pressed = true;
			pressedTime = Time.time;
			pressedFrame = Time.frameCount;
			
			DirectionPressed(MyKey);

			if(other.GetComponent<Rigidbody>())
			{
				other.GetComponent<Rigidbody>().AddForce(transform.up * 600);
			}
		}
	}

	void DirectionPressed(Direction dirPressed)
	{
		ConnectedMonitor.ReceiveKeyPress((int)dirPressed);
	}
}
