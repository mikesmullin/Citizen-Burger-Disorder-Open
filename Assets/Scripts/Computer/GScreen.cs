using UnityEngine;
using System.Collections;

public class GScreen : MonoBehaviour {
	
	public GameObject InterfacePrefab;
	public GameObject NavigationPrefab;
	
	public Computer computer;
	
	// Basic, "low level", positioning
	public Vector3 screenBasePos;
	public Vector3 screenOrigin;
	Vector3 screenCentre;
	Vector3 screenUp;
	Vector3 screenDown;
	Vector3 screenLeft;
	Vector3 screenRight;
	
	// Higher level positioning
	Vector2 screenBounds;
	public Vector2 screenResolution = new Vector2(800, 450);
	public float pixelsPerUnit;
	
	// Interfaces
	INavigation navigationBar;
	GInterface mainDisplay;

	// Use this for initialization
	void Awake ()
	{
		Init();		
	}
	
	public GInterface CreateInterface(float x, float y, float wPercent, float hPercent)
	{
		GInterface gInterface;
		
	//	gInterface = (Network.Instantiate(InterfacePrefab, screenCentre, transform.rotation, 2) as GameObject).GetComponent<GInterface>();
		gInterface = (Instantiate(InterfacePrefab, screenCentre, transform.rotation) as GameObject).GetComponent<GInterface>();
		gInterface.SetScreen(this);
		gInterface.SetBackgroundColor(Color.black);
		gInterface.bounds = new Rect(x, y, BoundsPercentageToPixels (wPercent,0).x, BoundsPercentageToPixels (0,hPercent).y);
		
		if(Network.isServer)
		{
			gInterface.GetComponent<NetworkView>().viewID = Network.AllocateViewID();	
		}
		
		return gInterface;
	}
	
	public INavigation CreateNavigation(float x, float y, float wPercent, float hPercent)
	{
		INavigation navigationBar;
		
	//	navigationBar = (Network.Instantiate(NavigationPrefab, screenCentre, transform.rotation, 2) as GameObject).GetComponent<INavigation>();
		navigationBar = (Instantiate(NavigationPrefab, screenCentre, transform.rotation) as GameObject).GetComponent<INavigation>();
		navigationBar.SetScreen(this);
		navigationBar.SetBackgroundColor(Color.black);
		navigationBar.bounds = new Rect(x, y, BoundsPercentageToPixels (wPercent,0).x, BoundsPercentageToPixels (0,hPercent).y);
		
		if(Network.isServer)
		{
			navigationBar.GetComponent<NetworkView>().viewID = Network.AllocateViewID();	
		}
		
		return navigationBar;
	}
	
	void Init()
	{
		// basic directions
		screenBasePos = transform.position;
		screenUp = (transform.up * transform.localScale.y * 0.5f);
		screenLeft = (-transform.right * transform.localScale.x * 0.5f);
		screenDown = -screenUp;
		screenRight = -screenLeft;

		// centre and 0,0 position of screen
		screenCentre = screenBasePos + (-transform.forward * transform.localScale.z * 0.51f);
		screenOrigin = screenCentre + screenUp + screenLeft;
		
		// Width and height, and resolution, of screen
		screenBounds = new Vector2 ( (screenLeft - screenRight).magnitude , (screenUp - screenDown).magnitude );
		pixelsPerUnit = screenResolution.x / screenBounds.x;
	}
	
	void Update()
	{
		Init();
	}
	
	public Vector2 BoundsPercentageToPixels(float wPercent=1.0f, float hPercent=1.0f)
	{
		float w = wPercent * screenBounds.x;
		float h = hPercent * screenBounds.y;
		
		Vector2 r = new Vector2(w, h) * pixelsPerUnit;
		return r;
	}
	
	public Vector2 BoundsPixelPosition(float wPixel=100f, float hPixel=100f)
	{
		float w = screenBounds.x / (screenResolution.x / wPixel);
		float h = screenBounds.y / (screenResolution.y / hPixel); 
		
		Vector2 r = new Vector2(w, h) * pixelsPerUnit;
		return r;
	}
	
	public void Draw(GInterface gi)
	{
		Vector3 drawPos = Vector3.zero;
		Vector3 xPos = (screenRight * (gi.bounds.x / screenResolution.x) * 2);
		Vector3 yPos = (screenDown  * (gi.bounds.y / screenResolution.y) * 2);
		drawPos = screenOrigin + xPos + yPos;
		
		gi.transform.parent = null;
		gi.transform.localScale = new Vector3(gi.bounds.width / pixelsPerUnit, gi.bounds.height / pixelsPerUnit, gi.transform.localScale.z);
		gi.CalculatePositioning();
		gi.transform.parent = transform;

		gi.transform.position = drawPos - gi.up + gi.left + -transform.forward * gi.zLayer;
	}
	
	public void Draw(GElement ge)
	{
		Vector3 drawPos = Vector3.zero;
		Vector3 xPos = (screenRight * ((ge.bounds.x + ge.parentInterface.bounds.x) / screenResolution.x) * 2);
		Vector3 yPos = (screenDown  * ((ge.bounds.y + ge.parentInterface.bounds.y) / screenResolution.y) * 2);
		drawPos = screenOrigin + -transform.forward * ge.zLayer + xPos + yPos;
		
		ge.transform.parent = null;
		ge.transform.localScale = new Vector3(ge.bounds.width / pixelsPerUnit, ge.bounds.height / pixelsPerUnit, ge.transform.localScale.z);
		ge.CalculatePositioning();
		ge.transform.parent = ge.parentInterface.transform;

		ge.transform.position = drawPos - ge.up + ge.left;
	}
}
