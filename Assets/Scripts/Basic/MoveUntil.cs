using UnityEngine;
using System.Collections;

public class MoveUntil : MonoBehaviour {
	
	public Vector3 movePos = Vector3.zero;
	
	public float moveTime;	
	
	public bool stopAtCollision = false;
	public bool pushForward = false;	
	public bool wasCollision = false;
	
	Vector3 moveToPos;
	Vector3 rotateToPos;
	
	float start = 0;
	float duration = 0.7F;

	// Use this for initialization
	void Start () {
		moveToPos = transform.position + movePos;		
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(start==0)
		{
			if((transform.position - moveToPos).magnitude >= 0.5F && !(stopAtCollision && wasCollision))
			{
				transform.position = Vector3.Lerp(transform.position, moveToPos, moveTime * Time.deltaTime);
			}
			else if(stopAtCollision && wasCollision)
			{
				moveToPos = transform.position;	
			}
		}
	
		if((transform.position - moveToPos).magnitude < 0.5F || (pushForward && start != 0))
		{
			if(pushForward && start==0 )
			{
				start = Time.time;
			}
			
			if(pushForward && Time.time < start + duration)
			{
				transform.RotateAround(transform.position + transform.up, transform.right, 60*Time.deltaTime);
			}
			else
			{
				if(GetComponent<Rigidbody>()!=null)
				{
					GetComponent<Rigidbody>().isKinematic = false;
				}
				enabled = false;
				print("disabled 1");
			}
		}

		if(wasCollision && !pushForward)
		{
			enabled = false;
			print("disabled due to collision");
		}
	}	
}
