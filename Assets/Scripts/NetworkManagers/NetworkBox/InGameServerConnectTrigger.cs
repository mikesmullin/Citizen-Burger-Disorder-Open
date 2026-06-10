using UnityEngine;
using System.Collections;

public class InGameServerConnectTrigger : MonoBehaviour {

	void OnTriggerEnter(Collider other)
	{
		if(other.GetComponent<InGameServerBox>())
		{
			HostData host = other.GetComponent<InGameServerBox>().Host;
			NetworkManager.netMan.ConnectTo(host);
		}
	}

	// Use this for initialization
	void Start () {
	
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
