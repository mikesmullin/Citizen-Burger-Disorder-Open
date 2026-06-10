using UnityEngine;
using System.Collections;

public class Box : MonoBehaviour {

	GameObject boxOpenedPrefab;

	public enum BoxContents
	{
		PattMcRat,
		SeedyCedric,
		GreenGrace
	}
	public BoxContents contents;

	NetworkObjectSpawner netSpawn;

	// Use this for initialization
	void Awake ()
	{
		boxOpenedPrefab = Resources.Load("Prefabs/Misc/BoxOpened") as GameObject;
	}

	void OnCollisionEnter(Collision collision)
	{
		if(Network.isServer && collision.gameObject.name.Equals("hand"))
		{
			OpenBox();
		}
	}

	Vector3 randomSpawnPos()
	{
		return transform.position + (Random.insideUnitSphere * 1);
	}

	[RPC]
	void SyncContents(NetworkViewID boxID, int contentsID)
	{
		Box b = NetworkView.Find(boxID).transform.GetComponent<Box>();

		switch(contentsID)
		{
		case 0:
			b.contents = Box.BoxContents.PattMcRat;
			break;
		case 1:
			b.contents = Box.BoxContents.SeedyCedric;
			break;
		case 2:
			b.contents = Box.BoxContents.GreenGrace;
			break;
		default:
			b.contents = Box.BoxContents.PattMcRat;
			break;
		}

		print ("Setting box contents to " + contentsID + ", " + b.contents);
	}

	void OpenBox()
	{
		if(!netSpawn) netSpawn = NetworkObjectSpawner.networkSpawner;

		netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.BoxOpened), transform.position, transform.rotation, Network.AllocateViewID());
		//Network.Instantiate(boxOpenedPrefab, transform.position, transform.rotation, 1);

		switch (contents)
		{
		case BoxContents.PattMcRat:
			for(int i=0; i<Random.Range(4, 7); i++)
			{
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.Patty), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
				//Network.Instantiate(pattyPre, randomSpawnPos(), transform.rotation, 1);
			}
			for(int i=0; i<Random.Range(4, 7); i++)
			{
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.Bacon), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
				//Network.Instantiate(baconPre, randomSpawnPos(), transform.rotation, 1);
			}
			break;
		case BoxContents.SeedyCedric:
			for(int i=0; i<Random.Range(4, 7); i++)
			{
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.BunTop), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.BunBottom), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
			//	Network.Instantiate(bunTopPre, randomSpawnPos(), transform.rotation, 1);
			//	Network.Instantiate(bunBotPre, randomSpawnPos(), transform.rotation, 1);
			}
			break;
		case BoxContents.GreenGrace:
			for(int i=0; i<Random.Range(1, 2); i++)
			{
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.LettuceFull), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
				//Network.Instantiate(lettucePre, randomSpawnPos(), transform.rotation, 1);
			}
			for(int i=0; i<Random.Range(4, 7); i++)
			{
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.Cheese), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
				//Network.Instantiate(cheesePre, randomSpawnPos(), transform.rotation, 1);
			}
			for(int i=0; i<Random.Range(2, 5); i++)
			{
				netSpawn.GetComponent<NetworkView>().RPC("InitObjectPrefab", RPCMode.All, netSpawn.PrefabToInt(NetworkObjectSpawner.PrefabList.Tomato), randomSpawnPos(), transform.rotation, Network.AllocateViewID());
				//Network.Instantiate(TomatoPre, randomSpawnPos(), transform.rotation, 1);
			}
			break;
		}

		GetComponent<PickupObject>().DestroyObject();
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
