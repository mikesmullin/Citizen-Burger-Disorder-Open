using UnityEngine;
using System.Collections;

public class AudioLibrary : MonoBehaviour {
	
	public AudioClip[] SFXplateCollisions;
	public AudioClip[] SFXwetCollisions;
	public AudioClip[] SFXdryCollisions;

	float audioWaitTime = 0.2f;
	float lastPlayTime;

	int lastPlayedIndex = 0;

	public void PlayWetAudio(Vector3 location)
	{
		if(SFXwetCollisions!=null && SFXwetCollisions.Length>0 && lastPlayTime + audioWaitTime < Time.time)
		{
			lastPlayTime = Time.time;
			AudioSource.PlayClipAtPoint(SFXwetCollisions[RandIndex(SFXwetCollisions.Length)],
			                            location);
		}
	}
	
	public void PlayPlateAudio(Vector3 location, float magnutide = 1)
	{
		if(SFXplateCollisions!=null && SFXplateCollisions.Length>0 && lastPlayTime + audioWaitTime < Time.time)
		{
			lastPlayTime = Time.time;

			AudioSource.PlayClipAtPoint(SFXplateCollisions[RandIndex(SFXplateCollisions.Length)],
			                            location, magnutide);
		}
	}
	
	public void PlayDryAudio(Vector3 location)
	{
		if(SFXdryCollisions!=null && SFXdryCollisions.Length>0 && lastPlayTime + audioWaitTime < Time.time)
		{
			lastPlayTime = Time.time;
			AudioSource.PlayClipAtPoint(SFXdryCollisions[RandIndex(SFXdryCollisions.Length)],
			                            location);
		}
	}

	int RandIndex(int length)
	{
		/*
		int botIndex = Random.Range(0, lastPlayedIndex);
		int topIndex = Random.Range(lastPlayedIndex+1, length);

		int r = botIndex;
		if(lastPlayedIndex == botIndex || ( lastPlayedIndex<length && Random.value>0.5f) ) r = topIndex;
		if(r == length) r--;

		lastPlayedIndex = r;

		print ("From 0 to " + lastPlayedIndex + ", to " + (lastPlayedIndex+1) + " " + length + ", " + r + " was picked."); 

		return r;*/

		int r = (lastPlayedIndex + Random.Range(0, length) + Random.Range(0, length)) % length;
		if(lastPlayTime == r) r = (r+1) % length;

		return r;
	}


	// Use this for initialization
	void Start () {
	
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
