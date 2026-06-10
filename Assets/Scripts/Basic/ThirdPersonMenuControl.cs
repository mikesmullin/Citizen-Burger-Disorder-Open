using UnityEngine;
using System.Collections;

public class ThirdPersonMenuControl : MonoBehaviour {

	float xMov = 0;
	float yMov = 0;
	float prevXMov = 0;
	float prevYMov = 0;
	float jumpMove = 0;
	
	public float moveSpeed = 10f;
	public Vector3 moveDir = Vector3.zero;
	public float gravity = 18.81F;
	float gravityToApply=0;

	float moveHeldDownTimer = 0;
	float timeUntilMaxMovement = 0.5f;
	float accelMultiply = 4f;

	float jumpPressedAt = 0;
	float jumpDuration = 0.1f;
	float jumpHeight = 0.3f;
	bool jumping = false;

	CharacterController controller;

	// Use this for initialization
	void Start ()
	{
		controller = GetComponent<CharacterController>();
	}

	void Boost()
	{
		moveHeldDownTimer = 0;
		StartJumping();
	}

	void StartJumping()
	{
		if(!jumping)
		{
			jumpMove = 0;
			jumping = true;
			jumpPressedAt = Time.time;
		}
	}

	void Jump()
	{
		jumpMove = Mathf.Lerp(0, jumpHeight, (Time.time - jumpPressedAt) / jumpDuration);

		if(Time.time - jumpPressedAt >= jumpDuration)
		{
			jumping = false;
			jumpMove = 0;
		}
	}

	public float GetXMove()
	{
		return xMov;
	}

	// Update is called once per frame
	void Update ()
	{		
		if(GetComponent<NetworkView>().isMine || true)
		{
		//	print (xMov + ", " + yMov);

			if(Input.GetButtonDown("Jump"))
			{
				Boost();
			}

			if(jumping) Jump ();

			float timeSinceHeldDown = 0;
			if((Input.GetButtonDown("Horizontal") || Input.GetButtonDown("Vertical")) && yMov == 0 && xMov == 0)
			{
				Boost();
			}
			else if(moveHeldDownTimer == 0) moveHeldDownTimer = Time.time;

			xMov = Input.GetAxis("Horizontal");
			yMov = Input.GetAxis("Vertical"); 

			//if(xMov != 0 && yMov != 0) StartJumping();
			if((prevXMov>=0 && xMov<0) || (prevXMov<=0 && xMov>0)) Boost();

			if(moveHeldDownTimer > 0) timeSinceHeldDown = Time.time - moveHeldDownTimer;
			float accelAmount = Mathf.Min(timeSinceHeldDown / timeUntilMaxMovement, 1);
			float finalAccelAmount = accelMultiply-accelAmount*(accelMultiply-1);

			moveDir = new Vector3(-xMov, jumpMove, -yMov);
			moveDir = transform.TransformDirection(moveDir);
			moveDir *= moveSpeed * finalAccelAmount;

			gravityToApply += gravity;	
			moveDir.y -= gravityToApply * Time.deltaTime;
			controller.Move(moveDir * Time.deltaTime);	

			moveDir = Vector3.zero;
			
			if(controller.isGrounded) gravityToApply = 0;

			prevXMov = xMov;
			prevYMov = yMov;
		}
	}
}
