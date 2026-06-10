using UnityEngine;
using System.Collections;

public class FollowGameObject : MonoBehaviour
{
	public GameObject follow;
	Vector3 distanceStart = new Vector3(0, 0, 0);
	public Vector3 distance = new Vector3(0, 0, 0);
	public bool rotate = false;
	public bool position = true;
	public bool lookAt = false;

	public bool lerpWithXMovement = false;

	public float followSpeed = 25f;
	public float rotationSpeed = 25f;
	
	// Use this for initialization
	void Start ()
	{
		distanceStart = distance;
	}
	
	// Update is called once per frame
	void LateUpdate ()
	{
		if(lerpWithXMovement)
		{
			Vector3 modifiedDist = Vector3.zero;
			modifiedDist.x = follow.GetComponent<ThirdPersonMenuControl>().GetXMove() * 2;

			if(modifiedDist.x != 0) distance = Vector3.Lerp(distance, distance + modifiedDist, followSpeed * Time.deltaTime);
			else distance = Vector3.Lerp(distance, distanceStart, followSpeed * Time.deltaTime);
		}

		if(follow!=null && position)
			transform.position = Vector3.Lerp(transform.position, follow.transform.position + distance, followSpeed * Time.deltaTime);

		if(follow!=null && rotate)
			transform.rotation = follow.transform.rotation;

		if(follow && lookAt)
		{
			Vector3 direction = ((follow.transform.position + new Vector3(0,distance.y,0)) - transform.position).normalized;
			Quaternion lookRotation = Quaternion.LookRotation(direction);

			transform.rotation = Quaternion.Slerp(transform.rotation, lookRotation, rotationSpeed * Time.deltaTime);
			//transform.LookAt(follow.transform.position);
		}
	}
}
