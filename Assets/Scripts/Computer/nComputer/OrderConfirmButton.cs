using UnityEngine;
using System.Collections;

public class OrderConfirmButton : MonoBehaviour {

	bool pressed = false;
	float pressedFrame = 0;
	float pressedTime = 0;
	float pressedDuration = 0.5f;

	Vector3 startPos;
	Vector3 pressedPos;

	Color baseColour;
	Color pressedColour;

	UISwipe swipe;

	float currentYOffset = -1.5f;
	float YOffsetInc = 0.35f;

	// Use this for initialization
	void Start () {
		startPos = transform.position;
		pressedPos = startPos - transform.up * 0.4f;

		baseColour = GetComponent<Renderer>().material.color;
		pressedColour = Color.green;

		swipe = GameObject.Find("OrderCanvus/Button").GetComponent<UISwipe>();
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(pressedTime + pressedDuration < Time.time)
		{
			pressed=false;
		}

		if(pressed)
		{
			transform.position = Vector3.Lerp(transform.position, pressedPos, 10 * Time.deltaTime);
			GetComponent<Renderer>().material.color = Color.Lerp(GetComponent<Renderer>().material.color, pressedColour, 10*Time.deltaTime);
		}
		else if((transform.position - startPos).magnitude > 0.1f)
		{
			transform.position = Vector3.Lerp(transform.position, startPos, 10 * Time.deltaTime);
			GetComponent<Renderer>().material.color = Color.Lerp(GetComponent<Renderer>().material.color, baseColour, 10*Time.deltaTime);
		}
	}

	void AddToCreationScreen()
	{
		string spriteToAdd = swipe.currentSprite;
		GameObject parentToAddTo = GameObject.Find("OrderCanvus/Mask/CurrentCreation");

		GameObject newSprite = GameObject.Instantiate(Resources.Load("UI/IngredientSprites/" + spriteToAdd),
		                       parentToAddTo.transform.position
		                       		+ (parentToAddTo.transform.up * currentYOffset),
		                       parentToAddTo.transform.rotation) as GameObject;
		newSprite.transform.parent = parentToAddTo.transform;
		newSprite.transform.localScale = new Vector3(0.5f,0.5f,0);

		currentYOffset += YOffsetInc;
	}

	void OnTriggerEnter(Collider other)
	{
		pressed = true;
		pressedTime = Time.time;
		pressedFrame = Time.frameCount;

		AddToCreationScreen();
	}
}
