using UnityEngine;
using System.Collections;

public class NetworkPhysicsThirdPersonController : MonoBehaviour {
	
	public string username = "";
	
	float speed = 10.0f;
	float gravity = 18.0f;
	float gravityToApply = 0;
	float turnSpeed = 25;
	float currentTurnspeed = 25;
	public float rollSpeed = 30;
	float rollCurrentSpeed = 0;
	Vector3 moveDir = Vector3.zero;
	
	float timerRollStart = 0;
	float timerRollDuration = 2F;
	
	public bool jumping = false;
	public bool rolling = false;
	
	Color c;
	TextMesh userText;
	Transform playerMovement;
	public Transform mainRenderer;
	NetworkAnimation nani;
	CharacterController controller;

	
	// Use this for initialization
	void Start ()
	{
		if(!GetComponent<NetworkView>().isMine)
		{
			enabled = false;	
		}
		else
		{	
			generateColor();
			userText = transform.FindChild("Username").GetComponent<TextMesh>();
			userText.text = username;
			GetComponent<NetworkView>().RPC("setUsername", RPCMode.OthersBuffered, username, GetComponent<NetworkView>().viewID);
			
			MouseOrbit ml = Camera.main.GetComponent<MouseOrbit>();
			playerMovement = GameObject.Find("bearings").transform;
			mainRenderer = transform.FindChild("Cube");
			nani = GetComponent<NetworkAnimation>();
			controller = GetComponent<CharacterController>();
			
			//rigidbody.freezeRotation = true;
		    //rigidbody.useGravity = false;

			if(ml.enabled == false)
			{
				ml.enabled = true;	
				ml.target = transform.FindChild("Eyes");
			}
		}
	}
	
	// Update is called once per frame
	void Update() 
	{		
		// static bearings for camera relations
		if(playerMovement!=null)
		{
			playerMovement.position = transform.position;
			playerMovement.rotation = Quaternion.Euler(0, Camera.main.transform.rotation.eulerAngles.y, 0);
		}
		
		if(GetComponent<NetworkView>().isMine)
		{	
			// Renderer Logic
			if(mainRenderer != null && mainRenderer.GetComponent<Renderer>().material.color != c)
				mainRenderer.GetComponent<Renderer>().material.SetColor("_Color", c);
			
			// Input Logic
			moveDir = new Vector3(-Input.GetAxis("Vertical"), 0, Input.GetAxis("Horizontal"));
			moveDir = transform.TransformDirection(moveDir);
			if(!rolling) moveDir *= speed;
			
			// Logic for being on the ground
			if(controller.isGrounded)
			{
				gravityToApply = 0;
				jumping = false;
				
				if(Input.GetButtonDown("Jump") && !rolling)
				{
					jumping = true;					
					transform.rotation = playerMovement.rotation * Quaternion.Euler(0, 90, 0);
				}
				
				if(Input.GetButtonDown("Roll") && !jumping)
				{
					timerRollStart = Time.time;
					rollCurrentSpeed = rollSpeed;
					rolling = true;
				}
			}
			
			// Jumping
			if(jumping) moveDir += transform.TransformDirection(-5, 10, 0);
			
			// Rolling
			if(rolling)
			{
				// Still rolling
				if(Time.time < timerRollStart + timerRollDuration)
				{
					if(Time.time > timerRollStart + (timerRollDuration/4))
					{
						rollCurrentSpeed /= 1.1F;
					}
					
					moveDir += transform.TransformDirection(new Vector3(-Input.GetAxis("Vertical"), 0, Input.GetAxis("Horizontal")) * rollCurrentSpeed);
				}
				else
				{
					rolling = false;
					timerRollStart = 0;
				}
			}
			
			// Movement Logic
			gravityToApply += gravity * Time.deltaTime;
			moveDir.y -= gravityToApply;
			moveDir *= Time.deltaTime;
			controller.Move(moveDir);
			
			// Animation Logic
			if((Input.GetAxis("Vertical")!=0 || Input.GetAxis("Horizontal")!=0) || (Input.GetButtonDown("Jump")) || Input.GetButtonDown("Roll"))
			{
				currentTurnspeed = turnSpeed;
				if(!controller.isGrounded) currentTurnspeed /= 14;
				
				transform.rotation = Quaternion.Lerp(transform.rotation, playerMovement.rotation * Quaternion.Euler(0, 90, 0), currentTurnspeed * Time.deltaTime);
				
				if(rolling)
				{
					if(Time.time < timerRollStart + (timerRollDuration / 3))
					{
						if(!GetComponent<Animation>().IsPlaying("Roll"))
							nani.SyncAnimation("Roll");
					}
					else
						nani.SyncAnimation("Idle");
				}
				else
				{
					if(!GetComponent<Animation>().IsPlaying("Walk_001"))
						nani.SyncAnimation("Walk_001");
				}
			}
			else
			{
				nani.SyncAnimation("Idle");
			}
		}
		else
		{
			transform.rotation = Quaternion.Euler(0, transform.rotation.y, 0);	
		}
	}
	
	void generateColor()
	{
		float r=0, g=0, b=0;
		
		if(Random.value > 0.5) r = 0.8F + (Random.value * 0.2F);
		if(Random.value > 0.5) g = 0.8F + (Random.value * 0.2F);
		if(Random.value > 0.5) b = 0.8F + (Random.value * 0.2F);
		
		if(r == 0 && g == 0 && b == 0)
		{
			if(Random.value > 0.3) r = 0.7F + (Random.value * 0.3F);
			if(Random.value > 0.3) g = 0.7F + (Random.value * 0.3F);
			if(Random.value > 0.3) b = 0.7F + (Random.value * 0.3F);	
		}
		if(r == 0 && g == 0 && b == 0)
		{
			if(Random.value > 0.1) r = 0.4F + (Random.value * 0.4F);
			if(Random.value > 0.1) g = 0.4F + (Random.value * 0.4F);
			if(Random.value > 0.1) b = 0.4F + (Random.value * 0.4F);	
		}
		
		c = new Color(r, g, b);
		
		c += new Color(0.6F, 0.6F, 0.6F);
		
		GetComponent<NetworkView>().RPC("setColor", RPCMode.OthersBuffered, r, g, b, GetComponent<NetworkView>().viewID);
	}
	
	[RPC]
	void setUsername(string u, NetworkViewID id)
	{
		if(!GetComponent<NetworkView>().isMine)
		{
			NetworkView.Find(id).transform.FindChild("Username").GetComponent<TextMesh>().text = u;	
			print ("Set " + id + " to have " + u + " as username.");
		}
	}
	
	
	[RPC]
	void setColor(float r, float g, float b, NetworkViewID id)
	{
		if(!GetComponent<NetworkView>().isMine)
		{
			c = new Color(r, g, b);
			c += new Color(0.6F, 0.6F, 0.6F);
			
			Transform target = NetworkView.Find(id).transform.FindChild("Cube");
			
			target.GetComponent<Renderer>().material.SetColor("_Color", c);
		}
	}
	
	void OnSerializeNetworkView(BitStream stream, NetworkMessageInfo info)
	{
		if(stream.isWriting)
		{
			Vector3 pos = transform.position;
			stream.Serialize(ref pos);
			
			/*
			Vector3 vel = rigidbody.velocity;
			stream.Serialize(ref vel);
			*/
			
		}
		else
		{
			Vector3 posRef = Vector3.zero;
			stream.Serialize(ref posRef);
			transform.position = posRef;
			
			/*
			Vector3 velRef = Vector3.zero;
			stream.Serialize(ref velRef);
			rigidbody.velocity = velRef;
			*/
		}
	}
}
