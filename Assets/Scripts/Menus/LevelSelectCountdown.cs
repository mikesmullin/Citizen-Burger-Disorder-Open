using UnityEngine;
using System.Collections;
using UnityEngine.UI;

public class LevelSelectCountdown : MonoBehaviour {

	public string text = "";
	public int secondsUntilCountdownFinishes = 5;
	Text textUI;

	bool countingDown = false;
	float countdownStartTime = 0;

	// Use this for initialization
	void Start ()
	{
		textUI = GetComponent<Text>();
	}

	public void StopCountdown()
	{
		countingDown = false;
		text = "";
	}

	public void StartCountdown(Vector3 countdownLocation)
	{
		print ("Go time!");

		countingDown = true;
		countdownStartTime = Time.time;
		transform.position = new Vector3(countdownLocation.x, transform.position.y, transform.position.z);
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(countingDown)
		{
			int countdownNumber = Mathf.RoundToInt(secondsUntilCountdownFinishes - (Time.time - countdownStartTime));
			text =  "" + countdownNumber;
			textUI.text = text;

			if(countdownNumber==0)
			{
				Application.LoadLevel("testArea01");
			}
		}
		else
		{
			textUI.text = text;
		}
	}
}
