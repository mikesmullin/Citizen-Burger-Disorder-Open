using UnityEngine;
using System.Collections;

public class InGameServerBox : MonoBehaviour {

	public HostData Host;

	public void SetHost(HostData host)
	{
		this.Host = host;
	}
}
