using UnityEngine;
using System.Collections;
using System;

public class NetworkAnimation : MonoBehaviour {
	
	public enum AniStates 
	{
		Walk_001 = 0,
		Idle,
		Roll,
		other
	}
	
	public AniStates currentAnimation = AniStates.Idle;
	public AniStates lastAnimation = AniStates.Idle;
	
	public void SyncAnimation(String animationValue)
	{
		currentAnimation = (AniStates)Enum.Parse(typeof(AniStates), animationValue);
	}
	
	// Update is called once per frame
	void Update ()
	{		
		if (lastAnimation != currentAnimation || Enum.GetName(typeof(AniStates), currentAnimation) == "Walk_001" || Enum.GetName(typeof(AniStates), currentAnimation) == "Roll")
		{
			lastAnimation = currentAnimation;
			GetComponent<Animation>().CrossFade(Enum.GetName(typeof(AniStates), currentAnimation));
			GetComponent<Animation>()["Walk_001"].normalizedSpeed = 1.0F;
		}
	}
	
	void OnSerializeNetworkView(BitStream stream, NetworkMessageInfo info)
	{
		if (stream.isWriting)
		{
			char ani = (char)currentAnimation;
			stream.Serialize(ref ani);
		}
		else
		{
			char ani = (char)0;
			stream.Serialize(ref ani);
			
			currentAnimation = (AniStates)ani;
		}	
	
	}

}
