using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class GInterface : MonoBehaviour {
	
	// Element prefab
	public GameObject elementPrefab;
	public GameObject buttonPrefab;
	
	// Elements
	public List<GElement> graphicElements = new List<GElement>();
	
	// parent
	public GScreen screen;
	
	// Positioning
	public Vector3 origin;
	public Vector3 up;
	public Vector3 left;
	
	public Rect bounds = new Rect(0, 0, 10, 10);
	public Vector2 scale;
	public float zLayer = 0.02f;
	
	public Color backgroundColor;
	
	public GElement CreateElement(float x, float y, float wPercent, float hPercent, string text="", bool store=true)
	{
		GElement newElement;
		
		//newElement = (Network.Instantiate(elementPrefab, transform.position + transform.forward * 0.5f, transform.rotation, 2) as GameObject).GetComponent<GElement>();
		newElement = (Instantiate(elementPrefab, transform.position + transform.forward * 0.5f, transform.rotation) as GameObject).GetComponent<GElement>();
		newElement.SetInterface(this);
		newElement.bounds = new Rect(x, y, BoundsPercentageToPixels(wPercent,0).x, BoundsPercentageToPixels(0,hPercent).y);
		newElement.text = text;
		newElement.zLayer = 0.07f;
		
		if(store)
		{
			graphicElements.Add(newElement);
			newElement.transform.parent = transform;
		}
		
		if(Network.isServer)
		{
			newElement.GetComponent<NetworkView>().viewID = Network.AllocateViewID();	
		}
		
		return newElement;
	}
	
	public GElement CreateButton(float x, float y, float wPercent, float hPercent, string text="", bool store=true)
	{
		GButton newButton;
		
		//newButton = (Network.Instantiate(buttonPrefab, transform.position + transform.forward * 0.5f, transform.rotation, 2) as GameObject).GetComponent<GButton>();
		newButton = (Instantiate(buttonPrefab, transform.position + transform.forward * 0.5f, transform.rotation) as GameObject).GetComponent<GButton>();
		newButton.SetInterface(this);
		newButton.bounds = new Rect(x, y, BoundsPercentageToPixels(wPercent,0).x, BoundsPercentageToPixels(0,hPercent).y);
		newButton.text = text;
		newButton.zLayer = 0.07f;
		
		if(store)
		{
			graphicElements.Add(newButton);
			newButton.transform.parent = transform;
		}
		
		if(Network.isServer)
		{
			newButton.GetComponent<NetworkView>().viewID = Network.AllocateViewID();	
		}
		
		return newButton;
	}

	// Update is called once per frame
	void Update ()
	{
		CalculatePositioning();
		screen.Draw(this);
	
		if(GetComponent<Renderer>().material.color != backgroundColor)
		{
			GetComponent<Renderer>().material.color = backgroundColor;				
		}		
	}
	
	public void CalculatePositioning()
	{
		// basic directions
		Vector3 screenBasePos = transform.position;
		up = (transform.up * transform.localScale.y * 0.5f);
		left = (transform.right * transform.localScale.x * 0.5f);

		// centre and 0,0 position of screen
		Vector3 centre = screenBasePos + (transform.forward * 0.02f);
		origin = centre + up - left;
	}
	
	public Vector2 BoundsPercentageToPixels(float wPercent=1.0f, float hPercent=1.0f)
	{
		float w = wPercent * bounds.width;
		float h = hPercent * bounds.height;
		
		Vector2 r = new Vector2(w, h);
		return r;
	}
	
	public Vector2 BoundsPixelPosition(float wPixel=100f, float hPixel=100f)
	{
		return screen.BoundsPixelPosition(wPixel, hPixel);
	}
	
	public void SetScreen(GScreen gScreen)
	{
		screen = gScreen;
		
		transform.parent = screen.transform;
	}
	
	public void SetBackgroundColor(Color c)
	{
		backgroundColor = c;
		transform.GetComponent<Renderer>().material.color = backgroundColor;
	}
	
	public void DrawElement(GElement ge)
	{
		screen.Draw(ge);
	}
	
	public void DrawButton(GButton gb)
	{
		screen.Draw(gb);
	}
}
