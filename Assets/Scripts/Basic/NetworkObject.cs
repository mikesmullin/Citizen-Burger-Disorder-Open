using UnityEngine;
using System.Collections;

public class NetworkObject : MonoBehaviour
{
	public bool positionOnly = false;
	public bool tracking = false;
	public bool hasBeenInit = false;

	public string resourceLocation = "Prefabs/";
	
	PickupObject pickup;

	Vector3 newPos;
	Vector3 startPos;
	Quaternion newRot;
	public float interpolationMS = 0.20f;
	int timestampCount = 0;
	int latestState = 0;
	bool networkRunning = false;

	int collisionCount = 0;
	float timeUntilCollisionCountResets = 1f;
	float lastCollisionTime = 0;
	bool sentRPCForLastCollision = false;

	public State[] states = new State[8];
	public struct State
	{
		internal double timestamp;
		internal Vector3 pos;
		internal Quaternion rot;
		internal Vector3 vel;
	}
	
	void Awake()
	{
		if(Network.isServer)
		{
			if(this.GetComponent<PickupObject>()) pickup = this.GetComponent<PickupObject>();
	
			startPos = transform.position;
			
			State state;
			state.timestamp = Network.time;
			state.pos = startPos;
			state.rot = Quaternion.identity;
			state.vel = Vector3.zero;
			
			states[0] = state;
		}
	}
	
	void OnGUI()
	{
		if(tracking)
		{
			double currentTime = Network.time;
			double interpolationTime = currentTime - interpolationMS;
			
			if(states[0].timestamp>interpolationTime)
			{
				GUI.backgroundColor = Color.white;
				GUI.Label(new Rect(10, 10, 300, 30), "Inter: " + states[0].timestamp + " >= " + (Network.time - interpolationMS));
			}
			else
			{
				GUI.contentColor = Color.black;
				GUI.Label(new Rect(10, 10, 300, 30), "Extra: " + states[0].timestamp + " < " + (Network.time - interpolationMS));
			}
			
			GUI.contentColor = Color.black;
			
			double avgPing = 0;
			
			for(int i=0; i<Mathf.Min(5, states.Length); i++)
			{
				double delay = (Network.time - states[i].timestamp);
				
				if(delay<interpolationMS) GUI.contentColor = Color.green;
				else GUI.contentColor = Color.red;
				
				GUI.Label(new Rect(10, 140 + (i*32), 500, 30), "["+i+"] delay: " + Mathf.Round((float)delay*100f));
				
				avgPing += (Network.time - states[i].timestamp);
			}
			
			GUI.contentColor = Color.white;
			
			GUI.Label(new Rect(10, 60, 400, 30), "Ping: " + Mathf.Round((float)(avgPing/5)*100f));
			
			GUI.Label(new Rect(10, 90, 400, 30), "Latest State: " + latestState);
		}
	}

	void OnCollisionStay(Collision collisionInfo)
	{
		if(Network.isServer)
		{
			lastCollisionTime = Time.time;
		}
	}
	
	public void Update()
	{			
		if(GetComponent<NetworkView>().isMine && Network.peerType != NetworkPeerType.Disconnected && !sentRPCForLastCollision && lastCollisionTime + timeUntilCollisionCountResets > Time.time && GetComponent<Rigidbody>() && GetComponent<Rigidbody>().velocity.magnitude < 0.5f)
		{
			GetComponent<NetworkView>().RPC ("SetObjectPosition", RPCMode.Others, transform.position, transform.rotation, GetComponent<NetworkView>().viewID);

			sentRPCForLastCollision = true;
		}

		if(Network.peerType != NetworkPeerType.Disconnected && !GetComponent<NetworkView>().isMine)
		{
			if(tag.Contains("Physics") && !name.Contains("rat"))
			{
				if(GetComponent<Renderer>() && GetComponent<Renderer>().isVisible) return;
				 // || ((states[0].pos - transform.position).magnitude<0.05f && states[0].vel.magnitude==0)
				if(states[0].pos == Vector3.zero) return;
			}
			
			if(GetComponent<Rigidbody>()) GetComponent<Rigidbody>().isKinematic = false;
			
			float interpolationBackTime = interpolationMS;
			double currentTime = Network.time;
			double interpolationTime = currentTime - interpolationBackTime;
			
			if(!pickup || (pickup && !pickup.beingHeld))
			{
				// We have a window of interpolationBackTime where we basically play
				// By having interpolationBackTime the average ping, you will usually use interpolation.
				// And only if no more data arrives we will use extrapolation
				
				// Use interpolation
				// Check if latest state exceeds interpolation time, if this is the case then
				// it is too old and extrapolation should be used
				if (states[0].timestamp > interpolationTime)
				{
					for (int i = 0; i < timestampCount; i++)
					{
						// Find the state which matches the interpolation time (time+0.1) or use last state
						if (states[i].timestamp <= interpolationTime || i == timestampCount - 1)
						{
							latestState = i;
							
							// The state one slot newer (<100ms) than the best playback state
							State rhs = states[Mathf.Max (i - 1, 0)];
							// The best playback state (closest to 100 ms old (default time))
							State lhs = states[i];
							
							// Use the time between the two slots to determine if interpolation is necessary
							double length = rhs.timestamp - lhs.timestamp;
							float t = 0.0f;
							// As the time difference gets closer to 100 ms t gets closer to 1 in
							// which case rhs is only used
							if (length > 0.0001)
							t = (float)((interpolationTime - lhs.timestamp) / length);
							
							// if t=0 => lhs is used directly
							transform.position = Vector3.Lerp(transform.position, Vector3.Lerp (lhs.pos, rhs.pos, t), 0.1f);
							if(!positionOnly) transform.rotation = Quaternion.Slerp (transform.rotation, Quaternion.Slerp (lhs.rot, rhs.rot, t), 0.1f);

							if(states[i].vel == Vector3.zero && GetComponent<Rigidbody>()!=null)
							{
								GetComponent<Rigidbody>().velocity = Vector3.zero;
								GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
							}

							return;
						}
					}
				// Use extrapolation. Here we do something really simple and just repeat the last
				// received state. You can do clever stuff with predicting what should happen.
				}
				else
				{
					if(GetComponent<FirstPersonControl>()) return;
					
					if(!networkRunning)
					{
						for(int i=1; i<timestampCount; i++)
						{
							states[i].pos = states[0].pos;	
							states[i].timestamp = Network.time;
						}
						
						networkRunning = true;
					}
					
					Vector3 oldPos;
					oldPos = transform.position;
					
					// oldPos = states[1].pos;
					Quaternion angle = Quaternion.FromToRotation(oldPos, states[0].pos);
					Vector3 segment = angle * (states[0].pos-oldPos);
					Vector3 position = states[0].pos+segment;

					if(states[0].vel == Vector3.zero && GetComponent<Rigidbody>()!=null)
					{
						GetComponent<Rigidbody>().velocity = Vector3.zero;
						GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
					}

					
					if(transform.position != position)
					{
						transform.position = Vector3.Lerp(transform.position, Vector3.Lerp(transform.position, position, 0.2f), 0.1f);
						if(!positionOnly) transform.rotation = Quaternion.Lerp(transform.rotation, states[0].rot, 0.2f);
					}
				}
			}

			if((states[0].pos - transform.position).magnitude > 0.1f) transform.position = states[0].pos;
		}
	}
	
	public void OnSerializeNetworkView(BitStream stream, NetworkMessageInfo info)
	{			
		if (stream.isWriting)
		{
		
			Vector3 pos = transform.localPosition;
			Quaternion rot = transform.localRotation;
			
			Vector3 vel = Vector3.zero;
			
			if(GetComponent<Rigidbody>())
			{
				vel = GetComponent<Rigidbody>().velocity;
			}
			
			stream.Serialize (ref pos);
			stream.Serialize (ref rot);			
		}
		else
		{
			Vector3 pos = Vector3.zero;
			Quaternion rot = Quaternion.identity;
			Vector3 vel = Vector3.zero;
			
			stream.Serialize (ref pos);
			stream.Serialize (ref rot);
			
			for (int i = states.Length - 1; i >= 1; i--)
			{
				states[i] = states[i - 1];
			}
			
			State state;
			state.timestamp = info.timestamp;
			state.pos = pos;
			state.rot = rot;
			state.vel = vel;
			
			states[0] = state;
			
			timestampCount = Mathf.Min (timestampCount + 1, states.Length);
			
			// ACTUALLY PROBABLY IMPORTANT THINK BEFORE DELETING
			/*
			for (int i = 0; i < timestampCount - 1; i++)
			{
				//if (states[i].timestamp < states[i + 1].timestamp)
					//Debug.Log ("State inconsistent " + transform.name);
			}
			*/
		}
	}
	
	
	void OnPlayerConnected(NetworkPlayer player)
	{
		if(tag!="Player")
		{
			Debug.Log(" not a Player!");

			if(!pickup || !pickup.createdInScene)
			{
				if(transform.parent!=null)
					NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObjectWithParent", RPCMode.Others, resourceLocation, transform.position, transform.rotation, GetComponent<NetworkView>().viewID, transform.parent.GetComponent<NetworkView>().viewID);
				else
					NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObject", RPCMode.Others, resourceLocation, transform.position, transform.rotation, GetComponent<NetworkView>().viewID);
			}

			if(transform.parent)
			{
				NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("SyncParent", RPCMode.Others, GetComponent<NetworkView>().viewID, transform.parent.GetComponent<NetworkView>().viewID);
			}

			GetComponent<NetworkView>().RPC("SyncObject", RPCMode.Others, transform.position, transform.rotation);
			if(GetComponent<Rigidbody>()) GetComponent<NetworkView>().RPC("SyncRigidbody", RPCMode.Others, GetComponent<Rigidbody>().velocity, GetComponent<Rigidbody>().angularVelocity);
		}
	}
	
	[RPC]
	void SetObjectPosition(Vector3 pos, Quaternion rot, NetworkViewID id)
	{		
		Transform obj = NetworkView.Find(id).transform;
		
		if(obj.name.Equals("PlateModel") || obj.name.Equals("burger-bottom")) obj = obj.parent;
		
		if(obj.GetComponent<Rigidbody>() && !obj.GetComponent<Rigidbody>().isKinematic)
		{
			obj.GetComponent<Rigidbody>().velocity = Vector3.zero;
			obj.GetComponent<Rigidbody>().angularVelocity = Vector3.zero;
		}
		
		obj.position = pos;
		obj.rotation = rot;

		states[0].pos = pos;
		states[0].rot = rot;
		
		newPos = pos;
		newRot = rot;
	}
	
	[RPC]
	void SyncObject(Vector3 pos, Quaternion rot)
	{
		transform.position = pos;
		transform.rotation = rot;
		
		for(int i=0; i<states.Length; i++)
		{
			states[i].pos = pos;
			states[i].rot = rot;
		}
	}

	[RPC]
	void SyncRigidbody(Vector3 vel, Vector3 aVel)
	{
		if(!GetComponent<Rigidbody>()) gameObject.AddComponent<Rigidbody>();
		
		if(!GetComponent<Rigidbody>().isKinematic)
		{
			GetComponent<Rigidbody>().velocity = vel;
			GetComponent<Rigidbody>().angularVelocity = aVel;
		}
	}
						
	Color rand()
	{
		Color c = Color.white;
		float rand = Random.value;
		
		if(rand>0.9) c = Color.red;
		else if(rand>0.8) c = Color.yellow;
		else if(rand>0.7) c = Color.green;
		else if(rand>0.6) c = Color.blue;
		else if(rand>0.5) c = Color.magenta;
		else if(rand>0.4) c = Color.cyan;
		else if(rand>0.3) c = Color.white;
		else if(rand>0.2) c = Color.Lerp(Color.red, Color.yellow, 0.5f);
		else
		{
			c = Color.black;	
		}
		
		return c;
	}
}
