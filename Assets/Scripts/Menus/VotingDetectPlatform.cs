using UnityEngine;
using System.Collections;

public class VotingDetectPlatform : MonoBehaviour {

	public int numberOfPlayers = 3;
	public VotingLights nearestLightBar = null;
	int playersOnThisPlatform = 0;

	// Use this for initialization
	void Start ()
	{
	
	}
	
	// Update is called once per frame
	void Update ()
	{

	}

	void OnTriggerEnter(Collider other)
	{
		if(other.tag.Equals("Player"))
		{
			playersOnThisPlatform++;

			if(Network.connections.Length>0) nearestLightBar.LightToPercent((float)playersOnThisPlatform / (float)Network.connections.Length);
			else nearestLightBar.LightToPercent((float)playersOnThisPlatform / (float)numberOfPlayers);
		}
	}

	void OnTriggerExit(Collider other)
	{
		if(other.tag.Equals("Player"))
		{
			playersOnThisPlatform--;

			if(Network.connections.Length>0) nearestLightBar.LightToPercent((float)playersOnThisPlatform / (float)Network.connections.Length);
			else nearestLightBar.LightToPercent((float)playersOnThisPlatform / (float)numberOfPlayers);
		}
	}
}
