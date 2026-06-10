using UnityEngine;
using System.Collections;

public class LockMouse : MonoBehaviour {

	MouseLook ml;
	
	// Use this for initialization
	void Start () {
		ml = Camera.main.GetComponent<MouseLook>();
	}

	public void SetCursorState (CursorLockMode wantedMode)
	{
		Cursor.lockState = CursorLockMode.Locked;
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Network.peerType != NetworkPeerType.Disconnected)
		{
			if(Input.GetKeyDown(KeyCode.Escape))
			{
				Debug.Log("Current: " + Cursor.lockState);

				if(Cursor.lockState == CursorLockMode.Locked)
				{
					ml.enabled = false;
					SetCursorState(CursorLockMode.None);
				}
				else if(Cursor.lockState == CursorLockMode.None)
				{
					Debug.Log("Current2: " + Cursor.lockState);
					SetCursorState(CursorLockMode.Locked);
				}

				Debug.Log("Current: " + Cursor.lockState);
			}	
		}
	}
}
