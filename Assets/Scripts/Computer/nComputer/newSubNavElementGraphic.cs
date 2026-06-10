using UnityEngine;
using System.Collections;
using UnityEngine.UI;

public class newSubNavElementGraphic : MonoBehaviour {

	public Text CopyText;
	public Image CopyImage;
	public string name;

	// Use this for initialization
	void Start ()
	{
		CloneFromCopy();
	}
	
	// Update is called once per frame
	void Update () {
	
	}

	void OnDisable()
	{
		ToggleVisible(false);
	}

	void OnEnable()
	{
		ToggleVisible(true);
		CloneFromCopy();
	}
	
	void CloneFromCopy()
	{
		if(CopyText)
		{
			GetComponent<Text>().text = CopyText.text;
		}

		if(CopyImage)
		{
			GetComponent<Image>().sprite = CopyImage.sprite;
		}
	}

	
	void ToggleVisible(bool visible)
	{
		if(GetComponent<Image>()) GetComponent<Image>().enabled = visible;
		if(GetComponent<Text>()) GetComponent<Text>().enabled = visible;

		foreach(Transform t in transform)
		{
			if(t.GetComponent<newSubNavElementGraphic>())
			{
				t.GetComponent<newSubNavElementGraphic>().enabled = visible;

			}
		}
	}
}
