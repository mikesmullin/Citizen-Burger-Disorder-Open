using UnityEngine;
using System.Collections;

public class DrawerInputController : MonoBehaviour {

	PickupObject pickup;

	public float drawerOpenDistance = 5f;
	Vector3 drawerStartPosition;

	// Use this for initialization
	void Start ()
	{
		pickup = this.GetComponent<PickupObject>();
		drawerStartPosition = transform.position;
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(pickup.beingHeld)
		{
			Vector3 targetPosition = pickup.armHoldingObject.transform.FindChild("hand").transform.position;


		//	Vector3 targetPosition = pickup.armHoldingObject.transform.position;

			Debug.DrawLine(transform.position, targetPosition, Color.red, 0.1f);

			float dist = (drawerStartPosition - targetPosition).magnitude;
			float angle = Vector3.Angle((drawerStartPosition - targetPosition), transform.forward);

			float goalDistance = dist * Mathf.Cos(Mathf.Deg2Rad * angle);
			goalDistance = -goalDistance;

			Debug.DrawLine(drawerStartPosition,
			               drawerStartPosition - (transform.forward * goalDistance),
			               Color.green, 0.1f);

			transform.position = Vector3.Lerp(transform.position, drawerStartPosition + transform.forward * Mathf.Clamp(goalDistance, 0, drawerOpenDistance), (dist/drawerOpenDistance) * 10 * Time.deltaTime);
		}
	}
}
