using UnityEngine;
using System.Collections;

public class TimeOfDay : MonoBehaviour {

	public static float currentTimeOfDay = 0;
	public static float dayStart = 0;
	public static float startTimeOfDay = 8; // 8am
	public static float endTimeOfDay = 22; // 8pm
	static float secondsInAnHour = 60;
	
	Color dayColor;
	Color nightColor;
	Color currentColor;


	// Use this for initialization
	void Start ()
	{
		dayColor = RenderSettings.ambientLight;
		currentColor = RenderSettings.ambientLight;

		if(Network.isServer)
		{
			nightColor = new Color(0.05f,0.05f,0.05f);
			dayStart = (float)Network.time;
		}
	}

	void OnPlayerConnected(NetworkPlayer player)
	{
		// Called on the server whenever new player connects
		GetComponent<NetworkView>().RPC("SyncTimeOfDay", RPCMode.Others, currentTimeOfDay, dayStart);
	}
	
	[RPC]
	void SyncTimeOfDay(float time, float timeStart)
	{
		print ("Set time of day to: " + time + " and started at " + timeStart);
		currentTimeOfDay = time;
		dayStart = timeStart;
	}

	void OnGUI()
	{
		GUI.skin.label.fontSize = 12;
		GUI.Label(new Rect(0, 0, 500, 20), "Time of day: " + (Mathf.Round((currentTimeOfDay)*10)/10));
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(currentTimeOfDay>12)
		{
			RenderSettings.ambientLight = Color.Lerp(dayColor, nightColor, (currentTimeOfDay-16)/(19-16));
		}
		else
		{
			RenderSettings.ambientLight = Color.Lerp(nightColor, dayColor, (currentTimeOfDay - 8)/(10-8));
		}
		
		currentTimeOfDay = startTimeOfDay + (((float)Network.time - dayStart) / secondsInAnHour) ;
		
		if(currentTimeOfDay>=endTimeOfDay)
		{
			dayStart = (float)Network.time;
			currentTimeOfDay = startTimeOfDay;
		}
	}
}
