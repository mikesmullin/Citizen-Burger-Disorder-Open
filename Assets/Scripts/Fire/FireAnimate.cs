using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class FireAnimate : MonoBehaviour {

	public static List<FireAnimate> AllFires = new List<FireAnimate>();

	public Flamable fireBase;

	public bool isLargeFire = false;

	Material fireMat;
	Light fireLight;

	float lightSpeed = 1;
	float lightIntensity = 5;
	float lightOffset = 1;

	float scaleSpeed = 1;
	float scaleIntensity = 0.2f;
	float scaleOffset = 1;

	float lastMaterialSwapTime = 0;
	float materialSwapDuration = 0;

	Light fireGlow;

	Collider[] colliderProximity;

	ParticleEmitter smoke;

	void OnParticleCollision(GameObject other)
	{
		if(Network.isServer && other.name.Equals("WaterEmitter"))
		{
			PutOut();
		}
	}

	void OnTriggerEnter(Collider other)
	{
		if(other.GetComponent<Flamable>())
		{
			if(!other.GetComponent<Flamable>().isOnFire)
				other.GetComponent<Flamable>().currentBurnHealth-=4;
		}
	}

	// Use this for initialization
	void Start () {

		smoke = transform.FindChild("Smoke").GetComponent<ParticleEmitter>();

		fireMat = GetComponent<Renderer>().material;
		fireGlow = GetComponent<Light>();

		AllFires.Add(this);
		StartCoroutine(RenderFires());

		Vector3 scaleFix = transform.localScale;
		scaleFix.y = -scaleFix.y;
		transform.localScale = scaleFix;
	}
	
	// Update is called once per frame
	void Update ()
	{
		smoke.emit = isLargeFire;

		if(lastMaterialSwapTime + materialSwapDuration < Time.time)
		{
			transform.localScale = new Vector3(-transform.localScale.x, transform.localScale.y, transform.localScale.z);
			lastMaterialSwapTime = Time.time;
			materialSwapDuration = Random.Range(0.1f, 0.3f);
		}
	}

	IEnumerator RenderFires()
	{
		while(this)
		{
			//print ("yolo");

			FlameOn();

			colliderProximity = Physics.OverlapSphere(transform.position, 1f);

			foreach(Collider c in colliderProximity)
			{
				if(c.GetComponent<FireAnimate>())
				{
					if(c.GetComponent<FireAnimate>().isLargeFire && c!=this.GetComponent<Collider>())
					{
						FlameOff();
					}
				}
			}

			yield return new WaitForSeconds(0.5f);
		}
	}

	void FlameOn()
	{
		if(!GetComponent<Renderer>().enabled)
		{
			GetComponent<Renderer>().enabled = true;
		}
	}

	void FlameOff()
	{
		if(GetComponent<Renderer>().enabled && fireBase!=null && fireBase.pickup!=null && !fireBase.pickup.beingHeld)
		{
			GetComponent<Renderer>().enabled = false;
		}
	}

	public void PutOut(bool sentFromFlamable=false)
	{
		if(Network.isServer)
		{
			FireWatch.RemoveFireReference(this);
			
			if(isLargeFire)
			{
				RemoveFromAllFires();
			}
			else if(!sentFromFlamable)
			{
				fireBase.FireBurnOut();
			}
			
			GetComponent<NetworkView>().RPC("PutOutFire", RPCMode.Others, this.GetComponent<NetworkView>().viewID);
			
			GameObject.Destroy(this.gameObject);
		}
	}

	[RPC]
	void PutOutFire(NetworkViewID objectID)
	{
		FireAnimate f;
		
		try
		{
			f = NetworkView.Find(objectID).GetComponent<FireAnimate>();
		}
		catch (UnityException e) { Debug.Log(e); return; }

		if(f.isLargeFire)
		{
			f.smoke.transform.parent = transform.root;
			f.smoke.emit = false;
			f.smoke.GetComponent<ParticleAnimator>().autodestruct = true;
		}

		GameObject.Destroy(f.gameObject);

		/*
		if(Network.isServer)
		{
			FireAnimate f;
			
			try
			{
				f = NetworkView.Find(objectID).GetComponent<FireAnimate>();
			}
			catch (UnityException e) { Debug.Log(e); return; }

			if(f.isLargeFire)
			{
				f.RemoveFromAllFires();
				Network.Destroy(f.gameObject);
			}
			else
			{
				f.fireBase.FireBurnOut();
			}
		}
		*/
	}

	public void RemoveFromAllFires()
	{
		AllFires.Remove(this);
	}
}
