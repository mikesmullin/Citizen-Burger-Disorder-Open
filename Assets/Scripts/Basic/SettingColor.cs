using UnityEngine;
using System.Collections;

public class SettingColor : MonoBehaviour {

	Color c;
	
	// Use this for initialization
	void Start () {
	
		
		
		//networkView.RPC("setColor", RPCMode.OthersBuffered, r, g, b, networkView.viewID);
	}
	
	[RPC]
	void useColorNetwork(NetworkViewID id)
	{
		Transform target = NetworkView.Find(id).transform;
		
		target.GetComponent<Renderer>().material.SetColor("_Color", c);
	}
	
	[RPC]
	void setColorNetwork(float r, float g, float b, NetworkViewID id)
	{
		c = new Color(r, g, b);
		
		Transform target = NetworkView.Find(id).transform;
		
		target.GetComponent<Renderer>().material.SetColor("_Color", c);
	}
	
	void setColor(float r, float g, float b)
	{
		c = new Color(r, g, b);	
	}
}
