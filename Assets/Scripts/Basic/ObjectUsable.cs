using UnityEngine;
using System.Collections;

public class ObjectUsable : PickupObject {
	
	public FirstPersonControl control;
	
	Vector3 defaultHeldPositionOffset;

	// 3D cursor
	public Object pencilPrefab;
	Transform pencil;
	Vector2 lastDrawPosition = Vector2.zero;
	
	public bool usingRightHandObject = false;
	public bool usingLeftHandObject = false;
	
	public bool holdingRightHandObject = false;
	public bool holdingLeftHandObject = false;
	
	bool stopUsingObject = false;
	
	int layerMask;
	
	// Use this for initialization
	void Start ()
	{
		layerMask = ~((1<<LayerMask.NameToLayer("Player")) | (1<<LayerMask.NameToLayer("Default")));
	}
	
	public void StopUsingObject(bool stop=true)
	{
		stopUsingObject = stop;	
	}
	
	// Update is called once per frame
	void Update ()
	{		
		usingRightHandObject = false;
		usingLeftHandObject = false;
		
		// Holding object
		if(beingHeld)
		{
			if(!control)
			{
				control = GameObject.Find("Player(Mine)").GetComponent<FirstPersonControl>();	
			}
			
			// Holding object in right hand
			if(Input.GetButton("Fire2") && Input.GetButton("RightHand")  && !usingLeftHandObject)
			{				
				holdingRightHandObject = true;
				
				if(Input.GetButton("RightHand") && beingUsed) usingRightHandObject = true;
				
				// Initiates using object
				if(Input.GetButtonDown("Fire1") && !Input.GetButton("LeftHand"))
				{	
					usingRightHandObject = true;
					
					if(beingUsed)
					{
						RaycastHit cursorHit;
						if(Physics.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), out cursorHit, 6f, layerMask))
						{
								print("Won't exit");
						}
						if(cursorHit.transform != transform)
						{
							print ("Will exit");
							stopUsingObject = true;
						}
					}
				}				
			}
			else
			{
				usingRightHandObject = false;
				holdingRightHandObject = false;
			}
			
			// Holding object in left hand
			if(Input.GetButton("Fire1") && Input.GetButton("LeftHand") && !usingRightHandObject)
			{
				holdingLeftHandObject = true;
				
				if(Input.GetButton("LeftHand") && beingUsed) usingLeftHandObject = true;
				
				// Initiates using object
				if(Input.GetButtonDown("Fire2") && !Input.GetButton("RightHand"))
				{
					usingLeftHandObject = true;
					
					if(beingUsed)
					{
						RaycastHit cursorHit;
						if(Physics.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), out cursorHit))
						{
							if(cursorHit.transform != transform)
							{
								print ("Will exit");
								stopUsingObject = true;
							}
							else
							{
								print("Won't exit");
							}
						}
					}
				}				
			}
			else
			{
				usingLeftHandObject = false;
				holdingLeftHandObject = false;
			}
		}
		/*
		else
		{
			usingRightHandObject = false;
			usingLeftHandObject = false;
		}
		*/
		if(usingRightHandObject || usingLeftHandObject)
		{
			if(!beingUsed)
			{
				beingUsed = true;				
				Camera.main.GetComponent<MouseLook>().enabled = false;
				Screen.lockCursor = false;
				
				if(pencil==null)
				{
					GameObject pencilObj = GameObject.Instantiate(pencilPrefab, transform.position, transform.rotation) as GameObject;
					pencil = pencilObj.transform;
				}
				else
				{
					pencil.transform.rotation = transform.rotation;
					pencil.transform.position = transform.position;
					
				}
				
				control.GetComponent<NetworkView>().RPC("setObjectCollisions", RPCMode.AllBuffered, false, GetComponent<NetworkView>().viewID);
			}
		}
		
		// Player has unselected the object
		if(stopUsingObject || !beingHeld)
		{
			if(beingUsed)
			{
				beingUsed = false;
				Camera.main.GetComponent<MouseLook>().enabled = true;
				Screen.lockCursor = true;
				
				GameObject.Destroy(pencil.gameObject);
				
				if(!GetComponent<Collider>().enabled)
				{
					control.GetComponent<NetworkView>().RPC("setObjectCollisions", RPCMode.AllBuffered, true, GetComponent<NetworkView>().viewID);	
				}
			}
		}
		
		// When an object is being used, unlock the mouse cursor and move an in-game pointer
		if(beingUsed)
		{
			Ray cursorRay = Camera.main.ScreenPointToRay(Input.mousePosition);
			RaycastHit cursorHit;

			if(Physics.Raycast(cursorRay, out cursorHit, 5, layerMask))
			{
				pencil.position = cursorHit.point;
			}
		}
		
		stopUsingObject = false;
	}
}
