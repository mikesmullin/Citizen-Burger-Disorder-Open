using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;

public class InGameServerList : MonoBehaviour {
	
	public GameObject ServerHostObjPrefab;

	private NetworkManager netManager;
	private List<Text> boxTexts = new List<Text>();

	private List<HostData> storedHostList = new List<HostData>();

	// Use this for initialization
	void Start ()
	{
		storedHostList = new List<HostData>();
		netManager = transform.root.GetComponent<NetworkManager>();
		StartCoroutine("UpdateServerList");
	}

	IEnumerator UpdateServerList()
	{
		while(true)
		{
			if(MasterServer.PollHostList().Length>0) UpdateServerBoxes();

			yield return new WaitForSeconds(2f);
		}
	}

	void UpdateServerBoxes()
	{
		List<HostData> newHostList = new List<HostData>(MasterServer.PollHostList());

		bool isDifferent = false;

		if(storedHostList.Count == newHostList.Count)
		{
			for(int i=0; i<storedHostList.Count; i++)
			{
				if(storedHostList[i].guid != newHostList[i].guid)
				{
					isDifferent = true;
					break;
				}
			}
		}
		else
		{
			isDifferent = true;
		}

		if(isDifferent)
		{
			storedHostList = newHostList;

			if(storedHostList.Count>1)
			{
				CreateChildren(storedHostList.Count - 1);
			}
		}
	}

	void CreateChildren(int childCount)
	{
		ClearAllObjects();
		boxTexts.Clear();

		for(int i=0; i<childCount; i++)
		{
			GameObject newBox = CreateChild(transform.position + transform.up * i);
			Text boxText = newBox.transform.GetChild(0).GetChild(0).GetComponent<Text>();
			boxText.text = storedHostList[i].guid;

			// assign this box a host
			newBox.GetComponent<InGameServerBox>().SetHost(storedHostList[i]);

			boxTexts.Add(boxText);
		}
	}

	GameObject CreateChild(Vector3 position)
	{
		return Camera.main.GetComponent<NetworkObjectSpawner>().Create(NetworkObjectSpawner.PrefabList.ServerBox,
		                                                        position,
		                                                        Quaternion.identity,
		                                                        Network.AllocateViewID(),
		                                                        GetComponent<NetworkView>().viewID);                                              
	}

	void ClearAllObjects()
	{
		int childCount = transform.childCount;
		for(int i=0; i<childCount; i++)
		{
			Destroy(transform.GetChild(i).gameObject);
		}
	}
}
