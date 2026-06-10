using UnityEngine;
using System.Collections;

[RequireComponent (typeof (ObjectUsable))]
public class DrawTexture : MonoBehaviour {
	
	public bool initNewTexOnStart = true;
	public bool editable = true;
	public Vector2 lastDrawPos = Vector2.zero;
	
	public bool seenTutorial = false;
	
	public Material generalTutorial;
	public Material leftHandTutorial;
	public Material rightHandTutorial;
	public Material usingLeftHandTutorial;
	public Material usingRightHandTutorial;
	public Material paperTutorial;
	
	ObjectUsable obj;
	
	// Use this for initialization
	void Start ()
	{
		obj = GetComponent<ObjectUsable>();
		
		if(initNewTexOnStart)
		{
			NewTex();
		}
	}
	
	void Update()
	{
		if(editable)
		{
			if(!seenTutorial)
			{
				if(obj.holdingRightHandObject)
				{
					if(obj.beingUsed)
					{				
						GetComponent<Renderer>().material.SetTexture("_Drawing", usingRightHandTutorial.GetTexture("_Drawing"));
					}
					else
					{
						GetComponent<Renderer>().material.SetTexture("_Drawing", rightHandTutorial.GetTexture("_Drawing"));
					}
				}
				else if(obj.holdingLeftHandObject)
				{
					if(obj.beingUsed)
					{				
						GetComponent<Renderer>().material.SetTexture("_Drawing", usingLeftHandTutorial.GetTexture("_Drawing"));
					}
					else
					{
						GetComponent<Renderer>().material.SetTexture("_Drawing", leftHandTutorial.GetTexture("_Drawing"));
					}
				}	
				else
				{
					GetComponent<Renderer>().material.SetTexture("_Drawing", generalTutorial.GetTexture("_Drawing"));
				}
			}
			
			if(obj.beingUsed && seenTutorial)
			{
				if((Input.GetButton("Fire1") && obj.usingRightHandObject) || (Input.GetButton("Fire2") && obj.usingLeftHandObject))
				{
					if((Input.GetAxis("Mouse X")!=0 || Input.GetAxis("Mouse Y")!=0) || Input.GetButtonDown("Fire1"))
					{
						Ray cursorRay = Camera.main.ScreenPointToRay(Input.mousePosition);
						RaycastHit hit;
						int layerMask = 1<<LayerMask.NameToLayer("Drawable");
						
						if(Physics.Raycast(cursorRay, out hit, 2f, layerMask))
						{
							DrawOnTransformTextureAtCursorPosition(hit.transform, hit);
						}
					}
				}
				
				// Transfer notepad texture to new paper
				if(obj.usingRightHandObject && Input.GetButton("LeftHand") && Input.GetButtonDown("Fire1"))
				{
					GameObject newPaper = Network.Instantiate(Resources.Load("Prefabs/Drawing/Paper"), obj.control.leftArm.GetChild(0).transform.position + obj.control.leftArm.GetChild(0).transform.forward * 0.5f, obj.control.leftArm.transform.rotation, 0) as GameObject;
	
					GetComponent<NetworkView>().RPC("MoveNotePageToPaper", RPCMode.All, this.GetComponent<NetworkView>().viewID, newPaper.GetComponent<NetworkView>().viewID, obj.control.GetComponent<NetworkView>().viewID, false);
					obj.control.leftArmObject = newPaper.transform;
					
					obj.StopUsingObject();
				}
				else if(obj.usingLeftHandObject && Input.GetButton("RightHand") && Input.GetButtonDown("Fire2"))
				{
					GameObject newPaper = Network.Instantiate(Resources.Load("Prefabs/Drawing/Paper"), obj.control.rightArm.GetChild(0).transform.position + obj.control.rightArm.GetChild(0).transform.forward * 0.5f, obj.control.rightArm.transform.rotation, 0) as GameObject;
	
					GetComponent<NetworkView>().RPC("MoveNotePageToPaper", RPCMode.All, this.GetComponent<NetworkView>().viewID, newPaper.GetComponent<NetworkView>().viewID, obj.control.GetComponent<NetworkView>().viewID, false);
					obj.control.rightArmObject = newPaper.transform;
					
					obj.StopUsingObject();
				}
				
				if(obj.usingLeftHandObject && Input.GetButtonUp("Fire2"))
				{
					GetComponent<NetworkView>().RPC("SetLastDraw", RPCMode.All, obj.control.GetComponent<NetworkView>().viewID, Vector3.zero);
				}
				
				if(obj.usingRightHandObject && Input.GetButtonUp("Fire1"))
				{
					GetComponent<NetworkView>().RPC("SetLastDraw", RPCMode.All, obj.control.GetComponent<NetworkView>().viewID, Vector3.zero);
				}
			}
			else if(obj.beingUsed && !seenTutorial)
			{
				// Create new paper, but don't use the poo texture
				if(obj.usingRightHandObject && Input.GetButton("LeftHand") && Input.GetButtonDown("Fire1"))
				{
					GameObject newPaper = Network.Instantiate(Resources.Load("Prefabs/Drawing/Paper"), obj.control.leftArm.GetChild(0).transform.position + obj.control.leftArm.GetChild(0).transform.forward * 0.5f, obj.control.leftArm.transform.rotation, 0) as GameObject;
	
					GetComponent<NetworkView>().RPC("MoveNotePageToPaper", RPCMode.All, this.GetComponent<NetworkView>().viewID, newPaper.GetComponent<NetworkView>().viewID, obj.control.GetComponent<NetworkView>().viewID, true);
					obj.control.leftArmObject = newPaper.transform;
					
					seenTutorial = true;
					
					obj.StopUsingObject();
				}
				else if(obj.usingLeftHandObject && Input.GetButton("RightHand") && Input.GetButtonDown("Fire2"))
				{
					GameObject newPaper = Network.Instantiate(Resources.Load("Prefabs/Drawing/Paper"), obj.control.rightArm.GetChild(0).transform.position + obj.control.rightArm.GetChild(0).transform.forward * 0.5f, obj.control.rightArm.transform.rotation, 0) as GameObject;
	
					GetComponent<NetworkView>().RPC("MoveNotePageToPaper", RPCMode.All, this.GetComponent<NetworkView>().viewID, newPaper.GetComponent<NetworkView>().viewID, obj.control.GetComponent<NetworkView>().viewID, true);
					obj.control.rightArmObject = newPaper.transform;
					
					seenTutorial = true;
					
					obj.StopUsingObject();
				}
			}
		}
	}
	
	
	void DrawOnTransformTextureAtCursorPosition(Transform transformToDrawOn, RaycastHit hit)
	{		
		int brushSize = 4;

		// get object's texture
		Texture2D tex = transformToDrawOn.GetComponent<Renderer>().material.GetTexture("_Drawing") as Texture2D;
		Vector2 pixUV = hit.textureCoord;
		pixUV.x *= tex.width;
		pixUV.y *= tex.height;
		
		GetComponent<NetworkView>().RPC("DrawOnTexture", RPCMode.All, obj.control.GetComponent<NetworkView>().viewID, transformToDrawOn.GetComponent<NetworkView>().viewID, (int)pixUV.x, (int)pixUV.y, brushSize);
	}
	
	[RPC]
	void MoveNotePageToPaper(NetworkViewID targetNotepad, NetworkViewID targetPaper, NetworkViewID playerCreating, bool ignoreTexture=false)
	{
		GameObject notePad = NetworkView.Find(targetNotepad).gameObject;
		GameObject newPaper = NetworkView.Find(targetPaper).gameObject;
		
		// Don't override this texture with its standard Start() setup
		newPaper.GetComponent<DrawTexture>().initNewTexOnStart = false;
		
		if(!seenTutorial) seenTutorial = true;
		
		// Create instance of current notepad paper
		Texture2D noteTex;
		if(!ignoreTexture)
		{
			noteTex = Instantiate( notePad.GetComponent<Renderer>().material.GetTexture("_Drawing") ) as Texture2D;
		}
		else
		{
			noteTex = GetNewTex();
		}
		
		// Create new texture the size of the area we want to crop
		Texture2D newDrawTexture = new Texture2D(256, 256, TextureFormat.ARGB32, false);
		newDrawTexture.SetPixels( noteTex.GetPixels(228, 15, 256, 256) );
		newDrawTexture.Apply();
		
		// And set
		if(!ignoreTexture)
		{
			newPaper.GetComponent<Renderer>().material.SetTexture("_Drawing", newDrawTexture);
		}
		else
		{
			newPaper.GetComponent<Renderer>().material.SetTexture("_Drawing", paperTutorial.GetTexture("_Drawing"));
		}
		
		// Also, clear the notepad texture.
		notePad.GetComponent<DrawTexture>().NewTex();	
	}
	
	[RPC]
	void DrawOnTexture(NetworkViewID callingPlayer, NetworkViewID targetTransform, int pixelX, int pixelY, int brushSize)
	{
		FirstPersonControl player = NetworkView.Find(callingPlayer).GetComponent<FirstPersonControl>();
		Texture2D targetTex = NetworkView.Find(targetTransform).GetComponent<Renderer>().material.GetTexture("_Drawing") as Texture2D;
		DrawTexture targetDrawTex = NetworkView.Find(targetTransform).GetComponent<DrawTexture>();
		
		Color[] colors = new Color[5*5];
		for(int i=0; i<5*5; i++)
		{
			colors[i] = Color.black;
		}
		
		Vector2 newDrawSpot = new Vector2(pixelX, pixelY);
		
		if(player.lastDrawPosition!=Vector2.zero)
		{
			float distance = new Vector2(player.lastDrawPosition.x - newDrawSpot.x, player.lastDrawPosition.y - newDrawSpot.y).magnitude;
			
			if(distance > 3)
			{				
				float steps = Mathf.Round(distance/3);
				
				for(int j=0; j<steps; j++)
				{
					targetTex.SetPixels((int)Mathf.Lerp(player.lastDrawPosition.x, newDrawSpot.x, j/steps), (int)Mathf.Lerp(player.lastDrawPosition.y, newDrawSpot.y, j/steps), brushSize, brushSize, colors);
				}
				
				targetTex.Apply();
			}
		}
		
		player.lastDrawPosition = newDrawSpot;
		
		targetTex.SetPixels(pixelX, pixelY, brushSize, brushSize, colors);
		targetTex.Apply();	
	}
	
	void OnSerializeNetworkView(BitStream stream, NetworkMessageInfo info)
	{
		if(stream.isWriting)
		{
			Vector3 lastDPos = new Vector3(lastDrawPos.x, lastDrawPos.y, 0);			
			stream.Serialize(ref lastDPos);
		}
		else
		{
			Vector3 lastDPos = Vector3.zero;
			stream.Serialize(ref lastDPos);
			lastDrawPos = new Vector2(lastDPos.x, lastDPos.y);
		}
	}
	
	[RPC]
	public void SetLastDraw(NetworkViewID playerID, Vector3 lastDraw3)
	{
		FirstPersonControl player = NetworkView.Find(playerID).GetComponent<FirstPersonControl>();
		
		player.lastDrawPosition = new Vector2(lastDraw3.x, lastDraw3.y);	
	}
	
	public Texture2D GetNewTex ()
	{
		Texture2D newDrawTexture = new Texture2D(512, 512, TextureFormat.ARGB32, true);
		
		Color[] colors = new Color[512*512];
		for(int i=0; i<512*512; i++)
		{
			colors[i] = Color.white;
		}
		
		newDrawTexture.SetPixels(colors);
		
		newDrawTexture.Apply();
		
		return newDrawTexture;
	}
	
	[RPC]
	public void NewTex ()
	{
		Texture2D newDrawTexture = new Texture2D(512, 512, TextureFormat.ARGB32, true);
		
		Color[] colors = new Color[512*512];
		for(int i=0; i<512*512; i++)
		{
			colors[i] = Color.white;
		}
		
		newDrawTexture.SetPixels(colors);
		
		newDrawTexture.Apply();
		
		GetComponent<Renderer>().material.SetTexture("_Drawing", newDrawTexture);
	}
	
	/*
				
				///////////////////////////////////// Use right handed object
				if(Input.GetButton("Fire1") && leftArmObject == null)
				{
					// Look at notepad - only if Fire1 was pressed THIS frame
					if(!Input.GetButton("LeftHand") && Input.GetButtonDown("Fire1") && !useRightHandObject && rightArmObject!=null && (rightArmObject.name.Equals("Notepad") || rightArmObject.name.Equals("StaffMenu")))
					{
						Screen.lockCursor = false;
						useRightHandObject = true;
						Camera.main.GetComponent<MouseLook>().enabled = false;
						
						usingNotepad = true;
						
						if(pencil==null)
						{
							GameObject pencilObj = GameObject.Instantiate(pencilPrefab, rightArmObject.position, rightArm.rotation) as GameObject;
							pencil = pencilObj.transform;
						}
						else
						{
							pencil.transform.rotation = rightArm.rotation;
							pencil.transform.position = rightArmObject.transform.position;
							
						}
					}
					else if(useRightHandObject)
					{
						// DRAW ON NOTEPAD IF SELECTED, OTHERWISE PUT DOWN NOTEPAD
						bool putDownNotepad = true;
						
						Ray cursorRay = Camera.main.ScreenPointToRay(Input.mousePosition);
						// reuse existing 'hit'
						
						if(Physics.Raycast(cursorRay, out hit, 2f, layerMask))
						{
							if((hit.transform.name.Equals("Notepad") || rightArmObject.name.Equals("StaffMenu")))
							{
								putDownNotepad = false;	
								
								 
								if((Input.GetAxis("Mouse X")!=0 || Input.GetAxis("Mouse Y")!=0) || Input.GetButtonDown("Fire1"))
								{
									DrawOnTransformTextureAtCursorPosition(hit.transform, hit);
								}
							}
						}
						
						if(Input.GetButtonDown("Fire1") && putDownNotepad)
						{
							useRightHandObject = false;	
							Camera.main.GetComponent<MouseLook>().enabled = true;
							usingNotepad = false;
							drawing = false;
							
							if(Network.isClient) rightArmObject.GetComponent<DrawTexture>().networkView.RPC("SendLastDraw", RPCMode.Server, Vector3.zero);
							else rightArmObject.GetComponent<DrawTexture>().lastDrawPos = Vector2.zero;
							
							lastDrawPosition = Vector2.zero;
							
							Screen.lockCursor = true;
							Screen.showCursor = false;

							// Tear out a piece of paper from the notepad if the notepad was unselected from the right side
							if(Input.GetButton("LeftHand") && rightArmObject.name.Equals("Notepad"))
							{								
								GameObject newPaper = Network.Instantiate(Resources.Load("Prefabs/Drawing/Paper"), leftArm.GetChild(0).transform.position + leftArm.GetChild(0).transform.forward * 0.5f, leftArm.transform.rotation, 0) as GameObject;
		
								networkView.RPC("MoveNotePageToPaper", RPCMode.All, rightArmObject.networkView.viewID, newPaper.networkView.viewID, this.gameObject.networkView.viewID);
								leftArmObject = newPaper.transform;
								if(leftArmObject.gameObject.layer == 0) leftArmObject.gameObject.layer = 8;
							}

							GameObject.Destroy(pencil.gameObject);
						}
					}
				}
				
				*/
	
	
}
