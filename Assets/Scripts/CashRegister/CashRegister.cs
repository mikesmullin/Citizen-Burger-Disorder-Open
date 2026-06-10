using UnityEngine;
using System.Collections;

public class CashRegister : MonoBehaviour {

	public float money = 100;

	TextMesh display;

	// Use this for initialization
	void Start () {
		display = transform.parent.FindChild("Display").GetComponent<TextMesh>();
	}
	
	// Update is called once per frame
	void Update ()
	{
	
	}

	void OnPlayerConnected(NetworkPlayer player)
	{
		GetComponent<NetworkView>().RPC("SyncMoney", RPCMode.Others, money);	
	}

	public void RefreshDisplay(float alterationValue=0)
	{
		money += alterationValue;

		display.text = "$" + money;

		if(Network.isServer) GetComponent<NetworkView>().RPC("SyncMoney", RPCMode.Others, money);
	}

	[RPC]
	void SyncMoney(float currentMoney)
	{
		money = currentMoney;

		RefreshDisplay();
	}

	void OnTriggerEnter(Collider other)
	{
		if(other.name.Contains("Tip") && !other.GetComponent<PickupObject>().beingHeld)
		{
			RefreshDisplay(2);

			other.gameObject.GetComponent<PickupObject>().DestroyObject();
		}
	}
}
