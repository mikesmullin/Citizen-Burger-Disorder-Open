using UnityEngine;
using System.Collections;

[RequireComponent (typeof (AudioSource))]
public class FirstPersonControl : MonoBehaviour {
	
	public CharacterController controller;
	public Camera camera;
	public Transform arm;
	
	public Transform leftArm;
	public Transform leftArmObject;
	PickupObject leftArmPickup;
	
	public Transform rightArm;
	public Transform rightArmObject;
	PickupObject rightArmPickup;
	
	public float gravity = 9.81F;
	public float moveSpeed = 16F;
	public float runMultiplier = 1.333F;
	public float crouchMultiplier = 0.25f;
	Vector3 moveDir = Vector3.zero;
	float gravityToApply=0;
	
	public int layerMask;

	int PreviousLeftObjectLayer;
	int PreviousRightObjectLayer;
	
	// arm reach when looking up and down
	float maxCameraAngleFromZero = 86;
	float armForwardBasedOnRotation = 0;
	float armExtraReach = 1.2f; // the distance forward the arm will go when camera is all the way down or up

	public string username = "";

	public static FirstPersonControl localPlayer;
	public AudioLibrary audioLibrary;

	public Vector2 lastDrawPosition = Vector2.zero;
	
	int spawnedItems = 0;
	int maxSpawnedItems = 8;

	menu mainMenu;
	
	// Use this for initialization
	void Awake ()
	{
		if(!GetComponent<NetworkView>().isMine)
		{
			enabled = false;	
		}
		else
		{	
			gameObject.name = "Player(Mine)";
			localPlayer = this;
			
			layerMask = ~((1<<8) | (1<<14) | (1<<15) | (1<<23));
			if(camera==null) camera = Camera.main;
			mainMenu = camera.GetComponent<menu>();
			audioLibrary = GetComponent<AudioLibrary>();
		}
	}

	// Update is called once per frame
	void Update ()
	{		
		if(GetComponent<NetworkView>().isMine)
		{	
			transform.localRotation = Quaternion.Euler(0, camera.transform.localEulerAngles.y, 0);
			
			float xMov = Input.GetAxis("Horizontal");
			float yMov = Input.GetAxis("Vertical"); 

			moveDir = new Vector3(xMov, 0, yMov);
			moveDir = transform.TransformDirection(moveDir);
			moveDir *= moveSpeed;
			
			// Camera FOV for running and walking
			if(Input.GetButton("Run"))
			{
				moveDir *= runMultiplier;
				if(camera.fieldOfView < 80) camera.fieldOfView += ((80 - camera.fieldOfView) / 0.1F) * Time.deltaTime;
			}
			else if(Input.GetButton("Walk"))
			{
				moveDir *= crouchMultiplier;
			}
			else
			{
				if(camera.fieldOfView > 70) camera.fieldOfView -= (Mathf.Abs(70 - camera.fieldOfView) / 0.1F) * Time.deltaTime;	
			}
			
			//////////////////////////////////////////////////////////////////////////// DROP OBJECTS //////////////////////////////////////////////////////////////////////////////////////
			if( ((Input.GetButtonUp("Fire1") || Input.GetButtonUp("LeftHand")) && leftArmObject) )
			{					
				if(!leftArmObject.GetComponent<PickupObject>().fixedInPlace)
				{
					Vector3 SafeDropPosition = leftArm.FindChild("hand").transform.position + leftArm.FindChild("hand").transform.forward * 2F;
					RaycastHit hit;

					if(Physics.Raycast(camera.transform.position, transform.forward, out hit, 1.5f, layerMask))
					{
						Debug.DrawLine(camera.transform.position, camera.transform.position + transform.forward * 1.5f, Color.black, 20f);
						SafeDropPosition =camera.transform.position - transform.forward * 0.2f;
					}
					else if(Physics.SphereCast(leftArm.transform.position, 0.2f, leftArm.transform.forward, out hit, (leftArm.transform.position - SafeDropPosition).magnitude, layerMask))
					{
						//SafeDropPosition = hit.point + (hit.point - SafeDropPosition).normalized + transform.up * 0.5f;

						Vector3 oldDrop = SafeDropPosition;
						SafeDropPosition = ((hit.point + leftArm.position) * 0.5f);

						if(Physics.SphereCast(SafeDropPosition, 0.2f, transform.forward, out hit, 3, layerMask))
						{
							SafeDropPosition = hit.point - transform.forward;
						}
						else
						{
							SafeDropPosition += transform.forward * 2;
						}

						Debug.DrawLine(oldDrop, SafeDropPosition, Color.red, 10f);

						leftArmObject.GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
						leftArmObject.GetComponent<Rigidbody>().velocity = Vector3.zero;
						leftArmObject.rotation = Quaternion.Euler(Vector3.zero);
					}

					GetComponent<NetworkView>().RPC("setObjectPosition", RPCMode.All, SafeDropPosition,
											transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0), leftArmObject.GetComponent<NetworkView>().viewID);
					GetComponent<NetworkView>().RPC("setObjectGravity", RPCMode.All, true, leftArmObject.GetComponent<NetworkView>().viewID);
					GetComponent<NetworkView>().RPC("setObjectCollisions", RPCMode.All, true, leftArmObject.GetComponent<NetworkView>().viewID);
				}

				Vector3[] movementHistory = leftArmPickup.positionHistory;

				if(movementHistory.Length>1 && (movementHistory[movementHistory.Length-1] - movementHistory[movementHistory.Length-2]).magnitude > 0.4f)
				{
					Vector3 average = Vector3.zero;
					float avgMag = 0;

					for(int i=0; i<movementHistory.Length; i++)
					{
						average += movementHistory[i];
					}

					for(int i=1; i<movementHistory.Length; i++)
					{
						avgMag += (movementHistory[i-1] - movementHistory[i]).magnitude;
					}
					avgMag /= movementHistory.Length;
					average /= movementHistory.Length;

					average = (leftArmObject.transform.position - average).normalized;

					leftArmObject.GetComponent<Rigidbody>().AddForce(average * avgMag * 1500);
				}

				leftArmObject.GetComponent<NetworkView>().RPC("SetBeingHeld", RPCMode.All, leftArmObject.GetComponent<NetworkView>().viewID, false, leftArm.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID);
				
				if(leftArmObject.gameObject.layer==8) leftArmObject.gameObject.layer = 0;

				leftArmObject.gameObject.layer = PreviousLeftObjectLayer;
				leftArmObject = null;
				leftArmPickup = null;
			}
			
			if( ((Input.GetButtonUp("Fire2") || Input.GetButtonUp("RightHand")) && rightArmObject) )
			{
				if(!rightArmObject.GetComponent<PickupObject>().fixedInPlace)
				{
					Vector3 SafeDropPosition = rightArm.FindChild("hand").transform.position + rightArm.FindChild("hand").transform.forward * 2F;
					RaycastHit hit;
					
					if(Physics.Raycast(camera.transform.position, transform.forward, out hit, 1.5f, layerMask))
					{
						Debug.DrawLine(camera.transform.position, camera.transform.position + transform.forward * 1.5f, Color.black, 20f);
						SafeDropPosition =camera.transform.position - transform.forward * 0.2f;
					}
					else if(Physics.SphereCast(rightArm.transform.position, 0.2f, rightArm.transform.forward, out hit, (rightArm.transform.position - SafeDropPosition).magnitude, layerMask))
					{
						//SafeDropPosition = hit.point + (hit.point - SafeDropPosition).normalized + transform.up * 0.5f;
						
						Vector3 oldDrop = SafeDropPosition;
						SafeDropPosition = ((hit.point + rightArm.position) * 0.5f);
						
						if(Physics.SphereCast(SafeDropPosition, 0.2f, transform.forward, out hit, 3, layerMask))
						{
							SafeDropPosition = hit.point - transform.forward;
						}
						else
						{
							SafeDropPosition += transform.forward * 2;
						}
						
						Debug.DrawLine(oldDrop, SafeDropPosition, Color.red, 10f);
						
						rightArmObject.GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
						rightArmObject.GetComponent<Rigidbody>().velocity = Vector3.zero;
						rightArmObject.rotation = Quaternion.Euler(Vector3.zero);
					}
					
					GetComponent<NetworkView>().RPC("setObjectPosition", RPCMode.All, SafeDropPosition,
					                                transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0), rightArmObject.GetComponent<NetworkView>().viewID);
					GetComponent<NetworkView>().RPC("setObjectGravity", RPCMode.All, true, rightArmObject.GetComponent<NetworkView>().viewID);
					GetComponent<NetworkView>().RPC("setObjectCollisions", RPCMode.All, true, rightArmObject.GetComponent<NetworkView>().viewID);
				}
				
				Vector3[] movementHistory = rightArmPickup.positionHistory;
				
				if(movementHistory.Length>1 && (movementHistory[movementHistory.Length-1] - movementHistory[movementHistory.Length-2]).magnitude > 0.4f)
				{
					Vector3 average = Vector3.zero;
					float avgMag = 0;
					
					for(int i=0; i<movementHistory.Length; i++)
					{
						average += movementHistory[i];
					}
					
					for(int i=1; i<movementHistory.Length; i++)
					{
						avgMag += (movementHistory[i-1] - movementHistory[i]).magnitude;
					}
					avgMag /= movementHistory.Length;
					average /= movementHistory.Length;
					
					average = (rightArmObject.transform.position - average).normalized;
					
					rightArmObject.GetComponent<Rigidbody>().AddForce(average * avgMag * 1500);
				}
				
				rightArmObject.GetComponent<NetworkView>().RPC("SetBeingHeld", RPCMode.All, rightArmObject.GetComponent<NetworkView>().viewID, false, rightArm.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID);
				
				if(rightArmObject.gameObject.layer==8) rightArmObject.gameObject.layer = 0;
				
				rightArmObject.gameObject.layer = PreviousRightObjectLayer;
				rightArmObject = null;
				rightArmPickup = null;
				/*
				GetComponent<NetworkView>().RPC("setObjectPosition", RPCMode.All, rightArm.FindChild("hand").transform.position + rightArm.FindChild("hand").transform.forward * 2F,
										transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0), rightArmObject.GetComponent<NetworkView>().viewID);
				GetComponent<NetworkView>().RPC("setObjectGravity", RPCMode.All, true, rightArmObject.GetComponent<NetworkView>().viewID);
				GetComponent<NetworkView>().RPC("setObjectCollisions", RPCMode.All, true, rightArmObject.GetComponent<NetworkView>().viewID);
					
				rightArmObject.GetComponent<NetworkView>().RPC("SetBeingHeld", RPCMode.All, rightArmObject.GetComponent<NetworkView>().viewID, false, rightArm.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID);
				
				if(rightArmObject.gameObject.layer==8) rightArmObject.gameObject.layer = 0;

				rightArmObject.gameObject.layer = PreviousLeftObjectLayer;
				rightArmObject = null;
				rightArmPickup = null;
				*/
			}
			
			//////////////////////////////////////////////////////////////////// LEFT ARM LOGIC ////////////////////////////////////////////////////////////////////

			if(Input.GetButtonDown("LeftHand"))
			{				
				// Generate left arm
				if(leftArm==null)
				{
					leftArm = (Transform)Network.Instantiate(arm, transform.position - transform.right + transform.up + transform.forward,
																  transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x, 0, 0), 1);
				}
				// otherwise, enable the arm
				else
				{
					// set position and rotation
					leftArm.position = transform.position - transform.right + transform.up + transform.forward;
					leftArm.rotation = transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x, 0, 0);

					// enable renderer and colliders
					GetComponent<NetworkView>().RPC("SetArmState", RPCMode.All, leftArm.GetComponent<NetworkView>().viewID, true);
				}
			}
			else if(Input.GetButton("LeftHand") && leftArm)
			{				
				// looking down
				if(camera.transform.rotation.eulerAngles.x <= maxCameraAngleFromZero)
				{
					armForwardBasedOnRotation = armExtraReach * (camera.transform.rotation.eulerAngles.x / maxCameraAngleFromZero);
				}
				// looking up
				else if(camera.transform.rotation.eulerAngles.x >= 360 - maxCameraAngleFromZero)
				{
					armForwardBasedOnRotation = armExtraReach * ( Mathf.Abs(360 - camera.transform.rotation.eulerAngles.x) / maxCameraAngleFromZero);
				}

				leftArm.position = Vector3.Lerp(leftArm.position, transform.position - transform.right + transform.up * 1.5F + transform.forward + (camera.transform.forward * armForwardBasedOnRotation), 25F*Time.deltaTime);
				leftArm.rotation = Quaternion.Lerp(leftArm.rotation, transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0), 20F*Time.deltaTime);	
			}
			else if(Input.GetButtonUp("LeftHand"))
			{				
				// Switch off the left arm
				if(leftArm!=null) 
				{
					GetComponent<NetworkView>().RPC("SetArmState", RPCMode.All, leftArm.GetComponent<NetworkView>().viewID, false);
				}
			}

			// Pick up objects with left hand
			if(Input.GetButton("Fire1") && Input.GetButton("LeftHand"))
			{
				RaycastHit hit;

				// Currently holding left arm object
				if(leftArmObject)
				{
					if(leftArmPickup)
					{
						if(!leftArmPickup.fixedInPlace)
						{	
							Vector3 pos = leftArm.FindChild("hand").transform.position + leftArm.FindChild("hand").transform.forward * 2F * leftArmPickup.heldPositionOffset.z
											+ leftArm.FindChild("hand").transform.right * leftArmPickup.heldPositionOffset.x
											+ leftArm.FindChild("hand").transform.up * leftArmPickup.heldPositionOffset.y;
							Quaternion rot = transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x + leftArmPickup.heldRotateXOffset, 0, 0);

							leftArmObject.position = Vector3.Lerp(leftArmObject.position, pos, 30F * Time.deltaTime);
							leftArmObject.rotation = Quaternion.Lerp(leftArmObject.rotation, rot, 30F * Time.deltaTime);	
						}
					}
					else
					{
						print("WHY IS THIS HAPPENING?");

						Vector3 pos = leftArm.FindChild("hand").transform.position + leftArm.FindChild("hand").transform.forward * 2F;
						Quaternion rot = transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0);

						leftArmObject.position = Vector3.Lerp(leftArmObject.position, pos, 30F * Time.deltaTime);
						leftArmObject.rotation = Quaternion.Lerp(leftArmObject.rotation, rot, 30F * Time.deltaTime);
					}
				
					if(leftArmObject.GetComponent<Rigidbody>() && !leftArmObject.GetComponent<Rigidbody>().isKinematic)
					{
						leftArmObject.GetComponent<Rigidbody>().velocity = Vector3.zero;
						leftArmObject.GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
					}
				}
				// Not holding object already, pick it up
				else
				{
					/*
					bool raySuccess = false;

					if(Physics.Raycast(leftArm.FindChild("hand").transform.position, leftArm.transform.forward, out hit, 4.75F, layerMask))
					{
						raySuccess = true;
						Grab(hit);
					}
*/
 					if(Physics.SphereCast(leftArm.FindChild("hand").transform.position, 0.25F, leftArm.transform.forward, out hit, 4.75F, layerMask))
					{
						Grab(hit);
					}
				}
			}
				
			//////////////////////////////////////////////////////////////////// RIGHT ARM LOGIC ////////////////////////////////////////////////////////////////////
			if(Input.GetButtonDown("RightHand"))
			{	
				// Generate right arm
				if(rightArm==null)
				{
					rightArm = (Transform)Network.Instantiate(arm, transform.position + transform.right + transform.up + transform.forward,
																  transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x, 0, 0), 1);
				}
				// otherwise, enable the arm
				else
				{
					// set position and rotation
					rightArm.position = transform.position + transform.right + transform.up + transform.forward;
					rightArm.rotation = transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x, 0, camera.transform.rotation.eulerAngles.z);
					
					// enable renderer and colliders
					GetComponent<NetworkView>().RPC("SetArmState", RPCMode.All, rightArm.GetComponent<NetworkView>().viewID, true);
				}
			}
			else if(Input.GetButton("RightHand") && rightArm)
			{					
				// looking down
				if(camera.transform.rotation.eulerAngles.x <= maxCameraAngleFromZero)
				{
					armForwardBasedOnRotation = armExtraReach * (camera.transform.rotation.eulerAngles.x / maxCameraAngleFromZero);
				}
				// looking up
				else if(camera.transform.rotation.eulerAngles.x >= 360 - maxCameraAngleFromZero)
				{
					armForwardBasedOnRotation = armExtraReach * ( Mathf.Abs(360 - camera.transform.rotation.eulerAngles.x) / maxCameraAngleFromZero);
				}
				
				if(!rightArmObject || !rightArmPickup.IsBeingUsed())
				{
					rightArm.position = Vector3.Lerp(rightArm.position, transform.position + transform.right + transform.up * 1.5F + transform.forward + (camera.transform.forward * armForwardBasedOnRotation), 25F*Time.deltaTime);
					rightArm.rotation = Quaternion.Lerp(rightArm.rotation, transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0), 20F*Time.deltaTime);				
				}
				else if(rightArmObject && rightArmPickup.IsBeingUsed())
				{
					// using right hand object
					rightArm.position = Vector3.Lerp(rightArm.position, transform.position + transform.right * 1.6f + transform.up * 1.5F + transform.forward + (-camera.transform.forward * 1f), 25F*Time.deltaTime);
					rightArm.rotation = Quaternion.Lerp(rightArm.rotation, transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x, 0, 0), 20F*Time.deltaTime);				
				}
			}
			else if(Input.GetButtonUp("RightHand"))
			{				
				// Switch off right arm
				if(rightArm!=null)
				{
					GetComponent<NetworkView>().RPC("SetArmState", RPCMode.All, rightArm.GetComponent<NetworkView>().viewID, false);
				}
			}

			// Pick up objects with right hand
			if(Input.GetButton("Fire2") && Input.GetButton("RightHand"))
			{
				RaycastHit hit;

				// Already holding an object
				if(rightArmObject)
				{
					if(rightArmPickup)
					{
						if(!rightArmPickup.fixedInPlace)
						{		
							Vector3 pos = rightArm.FindChild("hand").transform.position + rightArm.FindChild("hand").transform.forward * 2F * rightArmPickup.heldPositionOffset.z
											+ rightArm.FindChild("hand").transform.right * -rightArmPickup.heldPositionOffset.x
											+ rightArm.FindChild("hand").transform.up * rightArmPickup.heldPositionOffset.y;
							Quaternion rot = transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x + rightArmPickup.heldRotateXOffset, 0, 0);

							rightArmObject.position = Vector3.Lerp(rightArmObject.position, pos, 30F * Time.deltaTime);
							rightArmObject.rotation = Quaternion.Lerp(rightArmObject.rotation, rot, 30F * Time.deltaTime);
						}
					}
					else
					{
						Vector3 pos = rightArm.FindChild("hand").transform.position + rightArm.FindChild("hand").transform.forward * 2F;
						Quaternion rot = transform.rotation * Quaternion.Euler(camera.transform.rotation.eulerAngles.x - 30, 0, 0);

						rightArmObject.position = Vector3.Lerp(rightArmObject.position, pos, 30F * Time.deltaTime);
						rightArmObject.rotation = Quaternion.Lerp(rightArmObject.rotation, rot, 30F * Time.deltaTime);
					}
					
					if(rightArmObject.GetComponent<Rigidbody>() && !rightArmObject.GetComponent<Rigidbody>().isKinematic)
					{
						rightArmObject.GetComponent<Rigidbody>().velocity = Vector3.zero;
						rightArmObject.GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
					}
				}
				// Not holding object, pick it up
				else
				{
					bool raySuccess = false;
					
					if(Physics.Raycast(rightArm.FindChild("hand").transform.position, rightArm.transform.forward, out hit, 4.75F, layerMask))
					{
						raySuccess = true;
						Grab(hit, "right");
					}

					if(raySuccess==false && Physics.SphereCast(rightArm.FindChild("hand").transform.position, 0.25F, rightArm.transform.forward, out hit, 4.75F, layerMask))
					{
						Grab(hit, "right");
					}
				}

			}
			
			gravityToApply += gravity;	
			moveDir.y -= gravityToApply * Time.deltaTime;
			controller.Move(moveDir * Time.deltaTime);	
			
			if(controller.isGrounded) gravityToApply = 0;
		}
	}

	void Grab(RaycastHit hit, string arm="left")
	{		
		if(hit.transform != hit.collider.transform && hit.collider.GetComponent<PickupObject>())
		{
			PickupObject obj = hit.collider.GetComponent<PickupObject>();
			Transform tRoot = obj.transform.root;
			Transform cTrans;
			
			// Traverse and assign the top-most parent of this collider, unless the topmost is the root (which is always the cupboard)
			if(obj.transform.parent != obj.transform.root)
			{
				cTrans = obj.transform.parent;
				
				while(cTrans != tRoot)
				{
					if(cTrans.GetComponent<PickupObject>())
					{
						obj = cTrans.GetComponent<PickupObject>();
						break;
					}
					
					cTrans = cTrans.parent;
				}
			}
			
			if(obj.beingStored)
			{
				obj.GetComponent<NetworkView>().RPC("UnsetParent", RPCMode.All, obj.GetComponent<NetworkView>().viewID);
				obj.GetComponent<NetworkView>().RPC("SetActive", RPCMode.All, obj.GetComponent<NetworkView>().viewID, true);
				obj.GetComponent<NetworkView>().RPC("AddRigidbody", RPCMode.All, obj.GetComponent<NetworkView>().viewID);
				obj.GetComponent<NetworkView>().RPC("SetObservedToRigidbody", RPCMode.All, obj.GetComponent<NetworkView>().viewID);
				
				obj.beingStored = false;
			}
		}
		
		if(hit.transform.gameObject.tag.Contains("Physics") || hit.transform.root.tag.Contains("Physics"))
		{	
			if(arm=="left")
			{
				if(hit.transform.gameObject.tag.Contains("Physics")) leftArmObject = hit.transform;
				else if(hit.transform.root.tag.Contains("Physics")) leftArmObject = hit.transform.root;
				
				if(!leftArmObject.GetComponent<PickupObject>().fixedInPlace)
				{
					PreviousLeftObjectLayer = leftArmObject.gameObject.layer;
					leftArmObject.gameObject.layer = LayerMask.NameToLayer("Player");
					
					GetComponent<NetworkView>().RPC("setObjectGravity", RPCMode.All, false, leftArmObject.GetComponent<NetworkView>().viewID);
				}
				
				leftArmPickup = leftArmObject.GetComponent<PickupObject>();
				leftArmPickup.ResetHeldRotation();
				leftArmObject.GetComponent<NetworkView>().RPC("SetBeingHeld", RPCMode.All, leftArmObject.GetComponent<NetworkView>().viewID, true, leftArm.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID);
			}
			else if(arm=="right")
			{
				if(hit.transform.gameObject.tag.Contains("Physics")) rightArmObject = hit.transform;
				else if(hit.transform.root.tag.Contains("Physics")) rightArmObject = hit.transform.root;
				
				if(!rightArmObject.GetComponent<PickupObject>().fixedInPlace)
				{
					PreviousRightObjectLayer = rightArmObject.gameObject.layer;
					rightArmObject.gameObject.layer = LayerMask.NameToLayer("Player");
					
					GetComponent<NetworkView>().RPC("setObjectGravity", RPCMode.All, false, rightArmObject.GetComponent<NetworkView>().viewID);
				}
				
				rightArmPickup = rightArmObject.GetComponent<PickupObject>();
				rightArmPickup.ResetHeldRotation();
				rightArmObject.GetComponent<NetworkView>().RPC("SetBeingHeld", RPCMode.All, rightArmObject.GetComponent<NetworkView>().viewID, true, rightArm.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID);

			}
		}
	}
	
	void OnPlayerConnected(NetworkPlayer player)
	{	
		foreach(GameObject arm in GameObject.FindGameObjectsWithTag("Arm"))
		{
			print ("Found arm");
			
			GetComponent<NetworkView>().RPC("SetArmState", RPCMode.Others, arm.GetComponent<NetworkView>().viewID, arm.GetComponent<Collider>().GetComponent<Renderer>().enabled);
		}
	}
	
	[RPC]
	void SetArmState(NetworkViewID armID, bool active)
	{
		GameObject arm = NetworkView.Find(armID).gameObject;
		GameObject hand = arm.transform.GetChild(0).gameObject;
		
		arm.GetComponent<Renderer>().enabled = active;
		hand.GetComponent<Renderer>().enabled = active;
		hand.GetComponent<BoxCollider>().enabled = active;	
	}
	
	[RPC]
	void DestroyObject(NetworkViewID id)
	{
		GameObject destroyObj = NetworkView.Find(id).gameObject;
		
		if(destroyObj.tag.Equals("Arm"))
		{
			Network.RemoveRPCs(destroyObj.transform.GetChild(0).GetComponent<NetworkView>().viewID);
			Network.Destroy(destroyObj.transform.GetChild(0).gameObject);
		}
		
		Network.RemoveRPCs(id);
		Network.Destroy(destroyObj);
	}

	[RPC]
	void setObjectGravity(bool grav, NetworkViewID id)
	{
		Transform obj = NetworkView.Find(id).transform;
		if(obj.name.Equals("PlateModel") || obj.name.Equals("burger-bottom")) obj = obj.parent;
		
		if(obj.GetComponent<Rigidbody>()) obj.GetComponent<Rigidbody>().useGravity = grav;
	}
	
	[RPC]
	void setObjectKematic(bool kematic, NetworkViewID id)
	{
		Transform obj = NetworkView.Find(id).transform;
		if(obj.name.Equals("PlateModel") || obj.name.Equals("burger-bottom")) obj = obj.parent;
		
		obj.GetComponent<Rigidbody>().isKinematic = kematic;
	}
	
	[RPC]
	void setObjectCollisions(bool collide, NetworkViewID id)
	{
		Transform obj = NetworkView.Find(id).transform;
		if(obj.name.Equals("PlateModel") || obj.name.Equals("burger-bottom")) obj = obj.parent;

		if(!obj.name.Contains("notepad") && !obj.name.Contains("StaffMenu"))
		{
			obj.GetComponent<Collider>().enabled = collide;
	
			if(obj.GetComponent<Collider>().isTrigger == true && collide == false) print ("Error: unexpected isTrigger state");

			obj.GetComponent<Collider>().isTrigger = !collide;
		}		
	}
	
	[RPC]
	void setObjectPosition(Vector3 pos, Quaternion rot, NetworkViewID id)
	{		
		Transform obj = NetworkView.Find(id).transform;
		
		if(obj.name.Equals("PlateModel") || obj.name.Equals("burger-bottom")) obj = obj.parent;
		
		if(obj.GetComponent<Rigidbody>() && !obj.GetComponent<Rigidbody>().isKinematic)
		{
		//	obj.rigidbody.velocity = Vector3.zero;
		//	obj.rigidbody.angularVelocity = Vector3.zero;
		}

		obj.GetComponent<PickupObject>().MoveGoalPosition = pos;

		//obj.position = Vector3.Lerp(obj.position, pos, 30F * Time.deltaTime);
		obj.rotation = Quaternion.Lerp(obj.rotation, rot, 30F * Time.deltaTime);
	}
	
	[RPC]
	void SetUsername(NetworkViewID nametagID, string username)
	{
		TextMesh nametag = NetworkView.Find(nametagID).gameObject.GetComponent<TextMesh>();
		nametag.transform.root.GetComponent<FirstPersonControl>().username = username;

		nametag.text = username;
	}
}
