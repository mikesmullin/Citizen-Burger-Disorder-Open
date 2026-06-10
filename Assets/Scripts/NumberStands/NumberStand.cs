using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;

public class NumberStand : MonoBehaviour {

	public int numberStandNumber = 0;

	public List<Text> displayNumbers = new List<Text>();

	// Use this for initialization
	void Start ()
	{
		SetDisplayToNumber();
	}

	void SetDisplayToNumber()
	{
		foreach(Text t in displayNumbers)
		{
			t.text = "" + numberStandNumber;
		}
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
