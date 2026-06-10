using UnityEngine;
using System.Collections;

public class GElement : MonoBehaviour {
	
	public GInterface parentInterface;
	public INavigation parentNavigation;
	
	// Attached objects
	public GameObject textPrefab;
	TextMesh attachedText;
	
	// Low Level Positioning
	public Vector3 origin;
	public Vector3 up;
	public Vector3 left;
	
	// High level positioning
	public Rect bounds = new Rect(0, 0, 10, 10);
	public float zLayer = 0.01f;
	
	// Display
	public Color color;
	protected Color normalColor;
	public Color textColor;
	public string text;
	public int textSize;
	protected Material defaultMaterial;
	
	// Use this for initialization
	void Awake ()
	{	
		text = "< INIT >";
		CreateText(new Vector2(bounds.x, bounds.y));
		normalColor = color;
		defaultMaterial = GetComponent<Renderer>().material;
	}
	
	void Start()
	{
	}
	
	[RPC]
	public void SetText(string txt, bool hide=false)
	{
		text = txt;
		HideText(hide);
	}
	
	
	public void SetMaterialToFoodLocal(string food)
	{
		GetComponent<Renderer>().material = Menu.GetFoodMaterial(food);
	}
	
	[RPC]
	public void SetMaterialToFood(NetworkViewID id, string food)
	{
		Transform elementToChange = NetworkView.Find(id).transform;
		
		elementToChange.GetComponent<Renderer>().material = Menu.GetFoodMaterial(food);
		
		//print ("Changed '" + text + "' material to " + food);
	}
	
	[RPC]
	public void ResetMaterial(NetworkViewID id)
	{
		Transform elementToChange = NetworkView.Find(id).transform;
		
		elementToChange.GetComponent<Renderer>().material = elementToChange.GetComponent<GElement>().defaultMaterial;	
	}
	
	public bool SetUseable(bool active)
	{
		bool success = false;
		
		if(GetComponent<GButton>())
		{
			GetComponent<GButton>().usable = active;
			success = true;
		}
		
		return success;
	}
	
	public bool SetColor()
	{
		color = normalColor;
		
		return true;
	}
	
	public bool SetColor(Color c, string name="")
	{
		bool success = false;
		
		switch(name)
		{
		case "":
			normalColor = c;
			color = c;
			success = true;
			break;
		case "highlight":
			if(GetComponent<GButton>())
			{
				GetComponent<GButton>().hoverColor = c;
				success = true;
			}
			break;
		case "pressed":
			if(GetComponent<GButton>())
			{
				GetComponent<GButton>().pressedColor = c;
				success = true;
			}
			break;
		}
		
		return success;
		
	}
	
	public void CalculatePositioning()
	{
		// basic directions
		Vector3 screenBasePos = transform.position;
		up = (transform.up * transform.localScale.y * 0.5f);
		left = (transform.right * transform.localScale.x * 0.5f);

		// centre and 0,0 position of screen
		Vector3 centre = screenBasePos + (transform.forward * transform.localScale.z * 0.51f);
		origin = centre + up + left;
	}
	
	public void HideText(bool hide=true)
	{
		attachedText.gameObject.SetActive(!hide);	
	}
	
	public bool IsTextHidden()
	{
		return attachedText.gameObject.activeSelf;	
	}
	
	void CreateText(Vector2 position, int textSize=16)
	{
		// create text
		if(!attachedText)
		{
			//GameObject newText = Network.Instantiate(textPrefab, transform.position + transform.up * 0.5f - transform.forward * 0.0998f, transform.rotation, 2) as GameObject;
			GameObject newText = Instantiate(textPrefab, transform.position + transform.up * 0.6f - transform.forward * 0.01f, transform.rotation) as GameObject;
			attachedText = newText.GetComponent<TextMesh>();
			
			newText.transform.parent = this.transform;
			attachedText.fontSize = textSize;
			attachedText.GetComponent<Renderer>().material.SetColor("_Text Color", textColor);
			
			textSize = attachedText.fontSize;
		}
	}
	
	public void RefreshDisplay()
	{
		if(GetComponent<Renderer>().material.color != color)
		{
			GetComponent<Renderer>().material.color = color;				
		}
		
		if(attachedText.GetComponent<Renderer>().material.GetColor("_Color") !=  textColor)
		{
			attachedText.GetComponent<Renderer>().material.SetColor("_Color", textColor);	
		}
		
		if(!attachedText.text.Equals(text))
		{
			attachedText.text = text;
		}
		
		if(attachedText.fontSize != textSize)
		{
			attachedText.fontSize = textSize;	
		}
	}
	
	// Update is called once per frame
	public virtual void Update () {
		CalculatePositioning();
		RefreshDisplay();
		parentInterface.DrawElement(this);
	}
	
	public void SetInterface(GInterface gi)
	{
		this.parentInterface = gi;
		this.transform.parent = gi.transform;
	}
	
	public void SetInterface(INavigation inav)
	{
		this.parentInterface = inav;
		this.transform.parent = inav.transform;
	}
}
