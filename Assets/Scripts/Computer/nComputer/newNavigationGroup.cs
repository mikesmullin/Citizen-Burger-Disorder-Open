using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class newNavigationGroup : MonoBehaviour {

	public List<newNavigationElement> MenuOptions = new List<newNavigationElement>();
	public newNavigationElement currentSelectedOption;

	// Use this for initialization
	void Start ()
	{
		foreach(newNavigationElement navE in GetComponentsInChildren<newNavigationElement>())
		{
			MenuOptions.Add(navE);
		}
		
		if(MenuOptions.Count>0) currentSelectedOption = MenuOptions[0];
	}
	
	// Update is called once per frame
	void Update () {
	
	}
}
