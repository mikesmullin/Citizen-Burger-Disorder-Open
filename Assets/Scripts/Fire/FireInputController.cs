using UnityEngine;
using System.Collections;

public class FireInputController : MonoBehaviour {

	public bool WaterOn = false;

	PickupObject pickup;
	ParticleEmitter waterEmitter;
	ParticleEmitter foamEmitter;

	void OnPlayerConnected(NetworkPlayer player)
	{
		GetComponent<NetworkView>().RPC("SyncAllFireInput", player, GetComponent<NetworkView>().viewID, WaterOn);
	}
	
	[RPC]
	void SyncAllFireInput(NetworkViewID objectID, bool nWaterOn)
	{
		FireInputController f;
		
		try
		{
			f = NetworkView.Find(objectID).GetComponent<FireInputController>();
		}
		catch (UnityException e) { Debug.Log(e); return; }
		
		f.WaterOn = nWaterOn;
	}

	// Use this for initialization
	void Start ()
	{
		waterEmitter = transform.FindChild("WaterEmitter").GetComponent<ParticleEmitter>();
		foamEmitter = transform.FindChild("Foam").GetComponent<ParticleEmitter>();
		waterEmitter.emit = WaterOn;
		foamEmitter.emit = WaterOn;
		pickup = GetComponent<PickupObject>();	
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(pickup.beingHeld && pickup.playerHolding == FirstPersonControl.localPlayer)
		{
			if(Input.GetKey(OppositeHandKey()))
			{
				WaterOn = true;
				GetComponent<NetworkView>().RPC("EmitToggle", RPCMode.Others, this.GetComponent<NetworkView>().viewID, WaterOn);
			}
			else
			{
				WaterOn = false;
				GetComponent<NetworkView>().RPC("EmitToggle", RPCMode.Others, this.GetComponent<NetworkView>().viewID, WaterOn);
			}
		}


		if(GetComponent<NetworkView>().isMine && !pickup.playerHolding)
		{
			WaterOn = false;
		}
	}

	[RPC]
	void EmitToggle(NetworkViewID objectID, bool nWaterOn)
	{
		FireInputController f;
		
		try
		{
			f = NetworkView.Find(objectID).GetComponent<FireInputController>();
		}
		catch (UnityException e) { Debug.Log(e); return; }

		f.WaterOn = nWaterOn;
	}

	void LateUpdate()
	{
		waterEmitter.emit = WaterOn;
		foamEmitter.emit = WaterOn;
	}

	KeyCode OppositeHandKey()
	{
		if(pickup.playerHolding.leftArmObject && pickup.playerHolding.leftArmObject == transform)
		{
			return KeyCode.Mouse1;
		}
		else if(pickup.playerHolding.rightArmObject && pickup.playerHolding.rightArmObject == transform)
		{
			return KeyCode.Mouse0;
		}

		else return KeyCode.P;
	}
}
