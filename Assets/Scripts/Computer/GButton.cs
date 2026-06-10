using UnityEngine;
using System.Collections;

public class GButton : GElement
{
	FirstPersonControl player;
	
	public bool usable = true;
	
	// Highlighting colours
	public Color hoverColor = Color.Lerp(Color.blue, Color.white, 0.7f);
	public Color pressedColor = Color.Lerp(Color.green, Color.white, 0.6f);
	
	// Input tests
	bool playerHoveringLeft = false;
	bool playerHoveringRight = false;
	bool playerPressed = false;
	int layerMask;
	
	bool portable = false;
	ObjectUsable obj;
	
	// Use this for initialization
	void Start ()
	{
		layerMask = 1<<LayerMask.NameToLayer("Button");
		
		portable = transform.root.GetComponent<Computer>().portable;
		if(portable) obj = transform.root.GetComponent<ObjectUsable>();
	}
	
	// Update is called once per frame
	public override void Update ()
	{		
		if(usable)
		{
			if(player)
			{
				if(portable)
				{
					if(obj.beingUsed)
					{
						if((Input.GetButton("Fire1") && obj.usingRightHandObject) || (Input.GetButton("Fire2") && obj.usingLeftHandObject))
						{
							Ray cursorRay = Camera.main.ScreenPointToRay(Input.mousePosition);
							RaycastHit hit;
							
							if(Physics.Raycast(cursorRay, out hit, 10f, layerMask))
							{
								if(hit.collider.transform == this.GetComponent<Collider>().transform)
								{
									playerPressed = true;
									
									if(obj.usingRightHandObject) playerHoveringLeft = true;
									else playerHoveringRight = true;
								}
							}
						}
						else
						{
							Ray cursorRay = Camera.main.ScreenPointToRay(Input.mousePosition);
							RaycastHit hit;
							
							if(Physics.Raycast(cursorRay, out hit, 10f, layerMask))
							{
								if(hit.collider.transform == this.GetComponent<Collider>().transform)
								{
									if(obj.usingRightHandObject) playerHoveringLeft = true;
									else playerHoveringRight = true;
								}
							}
							else
							{
								playerHoveringLeft = false;
								playerHoveringRight = false;	
							}
						}
					}
				}
				else
				{
					// Check for hovering
					// left hand
					if(Input.GetButton("LeftHand") && player.leftArm)
					{
						Ray ray = new Ray(player.leftArm.transform.position, player.leftArm.transform.forward);
						
						RaycastHit hit;
						if(Physics.Raycast(ray, out hit, 14f, layerMask))
						{
							if(hit.collider.transform == this.GetComponent<Collider>().transform)
							{
								playerHoveringLeft = true;
							}
						}
						else
						{
							playerHoveringLeft = false;
							playerPressed = false;
						}
						
					}
					
					// right hand
					if(Input.GetButton("RightHand") && player.rightArm)
					{
						RaycastHit hit;
						if(Physics.Raycast(player.rightArm.transform.position, player.rightArm.transform.forward, out hit, 6f, layerMask))
						{
							if(hit.collider.transform == this.GetComponent<Collider>().transform)
							{
								playerHoveringRight = true;
							}
						}
						else
						{
							playerHoveringRight = false;
							playerPressed = false;
						}
					}
					
					// Turn off hovering
					if(!Input.GetButton("LeftHand") && !Input.GetButton("RightHand"))
					{
						playerHoveringLeft = false;
						playerHoveringRight = false;
					}
					
					// Button has been pressed
					if((Input.GetButton("Fire1") && playerHoveringLeft) || (Input.GetButton("Fire2") && playerHoveringRight))
					{
						playerPressed = true;
					}
				}
			}
			else
			{
				if(Time.frameCount%10==0)
				{
					foreach(GameObject p in GameObject.FindGameObjectsWithTag("Player"))
					{
						if(p.GetComponent<FirstPersonControl>().GetComponent<NetworkView>().isMine)
						{
							player = p.GetComponent<FirstPersonControl>();	
						}
					}
				}
			}
		
			// Change colours
			if(playerPressed)
			{
				color = pressedColor;
				
				// pressed this frame
				if((Input.GetButtonUp("Fire1") && playerHoveringLeft) || (Input.GetButtonUp("Fire2") && playerHoveringRight))
				{
					if(text=="") print ("Error: no name.");
					
					foreach(Computer c in Computer.computers)
					{
						c.GetComponent<NetworkView>().RPC("SetButtonDown", RPCMode.All, text);
					}
					
					playerPressed = false;
				}
			}
			else if(playerHoveringRight || playerHoveringLeft) color = Color.Lerp(hoverColor, pressedColor, 0.6f);
			else
			{
				color = Color.Lerp(Color.Lerp(normalColor, hoverColor, 0.5f), Color.Lerp(normalColor, hoverColor, 1f), (Mathf.Sin(Time.time * 2) * 1) + 0.3f);
			}
		}

		playerHoveringLeft = false;
		playerHoveringRight = false;
		
		CalculatePositioning();
		RefreshDisplay();
		parentInterface.DrawButton(this);
	}
}
