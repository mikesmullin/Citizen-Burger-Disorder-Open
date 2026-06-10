using UnityEngine;
using System.Collections;
using UnityEngine.UI;

[RequireComponent (typeof (Text))]
[RequireComponent (typeof (newNavigationElement))]
public class ElementNumber : MonoBehaviour {

	public int value = 0;
	public bool wrapToMod = false;
	public int mod = 5;

	public bool allowNegative = false;
	public int minVal = 0; // if 0, is ignored if allowNegative is true, or wraps to mod if wrapToMod is true
	public int maxVal = 100; // if wrapToMod is true, ignore this setting

	Text uiText;

	// Use this for initialization
	void Awake ()
	{
		uiText = GetComponent<Text>();

		int newValueFromText = 0;
		if(uiText.text.Length>0 && int.TryParse(uiText.text, out newValueFromText))
		{
			ChangeValue(newValueFromText);
		}
	}
	
	// Update is called once per frame
	void Update ()
	{
	
	}

	public void ResetValue()
	{
		if(uiText)
		{
			ChangeValue(1);
			uiText.text = "?";
		}
	}

	public void ChangeValue(int newValue)
	{
		value = newValue;

		if(wrapToMod)
		{
			if(newValue==0) value = mod-1;
			else value = value % mod;
		}
		else if(maxVal!=0)
		{
			value = Mathf.Min(value, maxVal);
		}

		if(!allowNegative || (allowNegative && minVal!=0))
		{
			value = Mathf.Max(value, minVal);
		}

		if(uiText) uiText.text = value + "";
	}
}
