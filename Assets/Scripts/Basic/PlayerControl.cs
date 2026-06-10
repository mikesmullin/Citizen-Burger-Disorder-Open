using UnityEngine;
using System.Collections;

public class PlayerControl : MonoBehaviour {
	
	float speed = 10;
	float maxVelocity = 15.0F;
	Color c;
	Transform playerMovement;
	
	float noInputDrag;
	float inputDrag;
	
	// Use this for initialization
	void Start ()
	{
		if(!GetComponent<NetworkView>().isMine)
		{
			enabled = false;	
		}
		else
		{		
			float r=0, g=0, b=0;
			
			if(Random.value > 0.5) r = 0.6F + (Random.value * 0.4F);
			if(Random.value > 0.5) g = 0.6F + (Random.value * 0.4F);
			if(Random.value > 0.5) b = 0.6F + (Random.value * 0.4F);
			
			if(r == 0 && g == 0 && b == 0)
			{
				if(Random.value > 0.3) r = 0.4F + (Random.value * 0.6F);
				if(Random.value > 0.3) g = 0.4F + (Random.value * 0.6F);
				if(Random.value > 0.3) b = 0.4F + (Random.value * 0.6F);	
			}
			if(r == 0 && g == 0 && b == 0)
			{
				if(Random.value > 0.1) r = 0.3F + (Random.value * 0.7F);
				if(Random.value > 0.1) g = 0.3F + (Random.value * 0.7F);
				if(Random.value > 0.1) b = 0.3F + (Random.value * 0.7F);	
			}
			
			c = new Color(r, g, b);
			
			c += new Color(0.6F, 0.6F, 0.6F);
			
			GetComponent<NetworkView>().RPC("setColor", RPCMode.OthersBuffered, r, g, b, GetComponent<NetworkView>().viewID);
			
			MouseOrbit ml = Camera.main.GetComponent<MouseOrbit>();
			playerMovement = GameObject.Find("bearings").transform;
			
			inputDrag = GetComponent<Rigidbody>().drag;
			noInputDrag = inputDrag * 200;
			
			if(ml.enabled == false)
			{
				ml.enabled = true;	
				ml.target = transform;
			}
		}
	}
	
	
	
	[RPC]
	void setColor(float r, float g, float b, NetworkViewID id)
	{
		c = new Color(r, g, b);
		
		Transform target = NetworkView.Find(id).transform.FindChild("Cube");
		
		target.GetComponent<Renderer>().material.SetColor("_Color", c);
	}
	
	// Update is called once per frame
	void Update () {
		
		playerMovement.position = transform.position;
		playerMovement.rotation = Quaternion.Euler(0, Camera.main.transform.rotation.eulerAngles.y, 0);

		if(Input.GetKeyDown(KeyCode.B))
		{
			buildStructureLogic();	
		}
		
		if(Input.GetKeyDown(KeyCode.V))
		{
			buildLadderLogic();	
		}
		
		if(Input.GetKeyDown(KeyCode.C))
		{
			buildPhysLogic();	
		}
		
		if(GetComponent<NetworkView>().isMine)
		{	
			if(transform.FindChild("Cube").GetComponent<Renderer>().material.color != c)
				transform.FindChild("Cube").GetComponent<Renderer>().material.SetColor("_Color", c);
			
			float moveH, moveV;
			moveH = Input.GetAxis("Horizontal");
			moveV = Input.GetAxis("Vertical");
			
			if(Input.GetAxis("Horizontal") != 0 || Input.GetAxis("Vertical") != 0 )
			{
				if(GetComponent<Rigidbody>().angularDrag != inputDrag) GetComponent<Rigidbody>().angularDrag = inputDrag;	
			}
			else
			{
				if(GetComponent<Rigidbody>().angularDrag != noInputDrag) GetComponent<Rigidbody>().angularDrag = noInputDrag;	
			}
			
			RaycastHit hit;
			if(!Physics.Raycast(transform.position, -Vector3.up, out hit, transform.localScale.y * 1.5F))
			{
				moveV *= 0.35F;
				moveH *= 0.35F;
			}
			
			// print(rigidbody.velocity + " and " + rigidbody.velocity.magnitude + " / " + maxVelocity);
			
			if(GetComponent<Rigidbody>().velocity.magnitude <= maxVelocity)
				GetComponent<Rigidbody>().AddForce((moveH * Camera.main.transform.right + -moveV * -playerMovement.forward) * speed);
		
		}		
	}
	
	void buildStructureLogic()
	{		
		RaycastHit hit;
		RaycastHit hit2;
		if(!Physics.Raycast(transform.position, playerMovement.forward, out hit, 4) && Physics.Raycast(transform.position, -Vector3.up, out hit, 5) && 
			Physics.Raycast(transform.position + playerMovement.forward * 4, -Vector3.up, out hit2, 4))
		{			
			GameObject strucTemp;
			
			Vector3 buildPos = hit2.point + playerMovement.forward * 10; // -playerMovement.up * 6
			strucTemp = (GameObject)Network.Instantiate(Resources.Load("Prefabs/Structure"), buildPos, playerMovement.rotation, 1); 
			
			MoveUntil mu = strucTemp.GetComponent<MoveUntil>();
			mu.movePos = new Vector3(0, 17, 0); // 30
			mu.moveTime = 2F;
			
			SettingColor setC = strucTemp.GetComponent<SettingColor>();
			
			float r, g, b;
			r = GetComponent<Renderer>().material.color.r * 0.3F;
			g = GetComponent<Renderer>().material.color.g * 0.3F;
			b = GetComponent<Renderer>().material.color.b * 0.3F;
			
			setC.GetComponent<NetworkView>().RPC("setColorNetwork", RPCMode.AllBuffered, r, g, b, strucTemp.GetComponent<NetworkView>().viewID);
		}
	}
	
	void buildLadderLogic()
	{		
		RaycastHit hit;
		if(!Physics.Raycast(transform.position, playerMovement.forward, out hit, 0.1F) && Physics.Raycast(transform.position, -Vector3.up, out hit, 7))
		{			
			GameObject strucTemp;
			
			Vector3 buildPos;
			
			if(Physics.Raycast(transform.position, playerMovement.forward, out hit, 15))
			{
				buildPos = transform.position + -playerMovement.up * 10 + -playerMovement.forward * 4;
			}
			else
			{
				buildPos = transform.position + -playerMovement.up * 10 + playerMovement.forward * 16;
			}
			

			strucTemp = (GameObject)Network.Instantiate(Resources.Load("Prefabs/Ladder"), buildPos, playerMovement.rotation * Quaternion.Euler(0, 0, 0), 1); 
			
			MoveUntil mu = strucTemp.GetComponent<MoveUntil>();
			strucTemp.GetComponent<Rigidbody>().isKinematic = true;
			mu.movePos = new Vector3(0, 35, 0);
			mu.pushForward = true;
			mu.moveTime = 2F;
			
			SettingColor setC = strucTemp.GetComponent<SettingColor>();
			
			float r, g, b;
			r = GetComponent<Renderer>().material.color.r * 0.4F;
			g = GetComponent<Renderer>().material.color.g * 0.4F;
			b = GetComponent<Renderer>().material.color.b * 0.4F;
			
			setC.GetComponent<NetworkView>().RPC("setColorNetwork", RPCMode.AllBuffered, r, g, b, strucTemp.GetComponent<NetworkView>().viewID);
			
		}
	}
	
	void buildPhysLogic()
	{		
		RaycastHit hit;
		if(!Physics.Raycast(transform.position, playerMovement.forward, out hit, 16) && Physics.Raycast(transform.position, -Vector3.up, out hit, 30))
		{			
			GameObject ballTemp;
			
			Vector3 buildPos = hit.point + playerMovement.up * 2 + playerMovement.forward * 16;
			ballTemp = (GameObject)Network.Instantiate(Resources.Load("Prefabs/Ball"), buildPos, playerMovement.rotation * Quaternion.Euler(0, 90, 0), 1); 

			SettingColor setC = ballTemp.GetComponent<SettingColor>();
			
			float r, g, b;
			r = GetComponent<Renderer>().material.color.r * 2;
			g = GetComponent<Renderer>().material.color.g * 2;
			b = GetComponent<Renderer>().material.color.b * 2;
			
			setC.GetComponent<NetworkView>().RPC("setColorNetwork", RPCMode.AllBuffered, r, g, b, ballTemp.GetComponent<NetworkView>().viewID);
		}
	}
	
	void OnSerializeNetworkView(BitStream stream, NetworkMessageInfo info)
	{
		if(stream.isWriting)
		{
			Vector3 pos = transform.position;
			stream.Serialize(ref pos);
			
			Vector3 vel = GetComponent<Rigidbody>().velocity;
			stream.Serialize(ref vel);
			
		}
		else
		{
			Vector3 posRef = Vector3.zero;
			stream.Serialize(ref posRef);
			transform.position = posRef;
			
			Vector3 velRef = Vector3.zero;
			stream.Serialize(ref velRef);
			GetComponent<Rigidbody>().velocity = velRef;
		}
	}
}
