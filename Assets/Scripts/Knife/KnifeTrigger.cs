using UnityEngine;
using System.Collections;

public class KnifeTrigger : MonoBehaviour
{
	public AudioClip[] choppingSFX;

	float KnifeCooldown = 0.3f;
	float timerStart = 0;

	void PlayChopAudio()
	{
		if(choppingSFX!=null)
			AudioSource.PlayClipAtPoint(choppingSFX[Random.Range(0, choppingSFX.Length)], transform.position);
	}

	void OnTriggerEnter(Collider other)
	{
		if(Network.isServer && other.GetComponent<Rigidbody>())
		{
			if(Time.time > KnifeCooldown + timerStart)
			{
				if(other.tag.Contains("Physics"))
				{
					if(other.tag.Equals("PhysicsFood"))
						other.GetComponent<Rigidbody>().AddForce(transform.up * 900f - transform.forward * 500f);

					if(other.name.Contains("Lettuce-Head-Full"))
					{
						PlayChopAudio();

						other.transform.LookAt(transform.position);

						NetworkViewID newID = Network.AllocateViewID();
						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All,
						                                                    NetworkObjectSpawner.networkSpawner.PrefabToInt(NetworkObjectSpawner.PrefabList.LettuceHalf),
						                                                    other.transform.position,
						                                                    other.transform.rotation * Quaternion.Euler(0, 0, -5),
						                                                    newID);
						newID = Network.AllocateViewID();
						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All,
						                                                    NetworkObjectSpawner.networkSpawner.PrefabToInt(NetworkObjectSpawner.PrefabList.LettuceHalf),
						                                                    other.transform.position,
						                                                    other.transform.rotation * Quaternion.Euler(0, 180, 5),
						                                                    newID);

						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("DestroyObject", RPCMode.All,
						                                                    other.gameObject.GetComponent<NetworkView>().viewID);

						/*
						GameObject.Instantiate(Resources.Load("Prefabs/Food/Lettuce-Head-Part"),
						                       other.transform.position,
						                       other.transform.rotation * Quaternion.Euler(0, 0, -5));
						GameObject.Instantiate(Resources.Load("Prefabs/Food/Lettuce-Head-Part"),
						                       other.transform.position,
						                       other.transform.rotation * Quaternion.Euler(0, 180, 5));
						GameObject.Destroy(other.gameObject);
						*/

						timerStart = Time.time;
					}

					if(other.name.Contains("Lettuce-Head-Part"))
					{
						PlayChopAudio();

						other.transform.LookAt(transform.position);

						NetworkViewID newID = Network.AllocateViewID();
						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All,
						                                                    NetworkObjectSpawner.networkSpawner.PrefabToInt(NetworkObjectSpawner.PrefabList.Lettuce),
						                                                    other.transform.position,
						                                                    other.transform.rotation * Quaternion.Euler(0, 0, -90),
						                                                    newID);

						newID = Network.AllocateViewID();
						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All,
						                                                    NetworkObjectSpawner.networkSpawner.PrefabToInt(NetworkObjectSpawner.PrefabList.Lettuce),
						                                                    other.transform.position + other.transform.right * 0.1f,
						                                                    other.transform.rotation * Quaternion.Euler(0, 0, -90),
						                                                    newID);

						newID = Network.AllocateViewID();
						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All,
						                                                    NetworkObjectSpawner.networkSpawner.PrefabToInt(NetworkObjectSpawner.PrefabList.Lettuce),
						                                                    other.transform.position + other.transform.right * 0.1f * 2f,
						                                                    other.transform.rotation * Quaternion.Euler(0, 0, -90),
						                                                    newID);

						NetworkObjectSpawner.networkSpawner.GetComponent<NetworkView>().RPC("DestroyObject", RPCMode.All,
						                                                    other.gameObject.GetComponent<NetworkView>().viewID);

						/*
						GameObject.Instantiate(Resources.Load("Prefabs/Food/Lettuce"),
						                       other.transform.position,
						                       other.transform.rotation * Quaternion.Euler(0, 0, -5));
						GameObject.Instantiate(Resources.Load("Prefabs/Food/Lettuce"),
						                       other.transform.position + other.transform.right * 0.3f,
						                       other.transform.rotation * Quaternion.Euler(0, 0, -5));
						GameObject.Instantiate(Resources.Load("Prefabs/Food/Lettuce"),
						                       other.transform.position + other.transform.right * 0.3f * 2f,
						                       other.transform.rotation * Quaternion.Euler(0, 0, -5));

						GameObject.Destroy(other.gameObject);
						*/

						timerStart = Time.time;
					}
				}
			}
		}
	}

	// Use this for initialization
	void Start () {
	
	}
	
	// Update is called once per frame
	void Update ()
	{
	}
}
