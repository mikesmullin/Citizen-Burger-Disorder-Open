using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;

public class ElementCreateOrderOverview : MonoBehaviour
{
	public static ElementCreateOrderOverview OrderCreateComputer;

	public List<string> CurrentOrder = new List<string>();
	public List<Image> CurrentOrderDisplayObjects = new List<Image>();
	int maxOrderItems = 4;
	int currentIndexPosition = 0;
	public int currentTableID = 0;

	public ElementNumber tableNumberElement;

	public NPC npcInQueue;

	public void AddToOrder(string foodName)
	{
		if(currentIndexPosition<4)
		{
//			print (foodName);
//			print (Menu.GetFoodSprite(foodName).name);

			CurrentOrder[currentIndexPosition] = foodName;
			CurrentOrderDisplayObjects[currentIndexPosition].sprite = Menu.GetFoodSprite(foodName);

			if(enabled) CurrentOrderDisplayObjects[currentIndexPosition].enabled = true;

			currentIndexPosition++;
		}
	}

	// Use this for initialization
	void Awake ()
	{
		OrderCreateComputer = this;
		ResetAllCurrentOrders();
	}

	// Update is called once per frame
	void Update ()
	{

	}
	
	void OnEnable()
	{
		ToggleCurrentOrderDisplay(true);
	}
	
	void OnDisable()
	{
		ToggleCurrentOrderDisplay(false);
	}

	public void ResetAllCurrentOrders()
	{
		currentIndexPosition = 0;

		CurrentOrder.Clear();
		for(int i=0; i<maxOrderItems; i++)
		{
			CurrentOrder.Add("");

			CurrentOrderDisplayObjects[i].sprite = null;
			CurrentOrderDisplayObjects[i].enabled = false;
		}

		if(tableNumberElement) tableNumberElement.ResetValue();
	}

	void HideUnsetOrderDisplays()
	{
		foreach(Image i in CurrentOrderDisplayObjects)
		{
			int index = CurrentOrderDisplayObjects.IndexOf(i);

			if(CurrentOrder[index]=="")
			{
				i.enabled = false;
			}
		}
	}


	void ToggleCurrentOrderDisplay(bool visible)
	{
		foreach(Image i in CurrentOrderDisplayObjects)
		{
			i.enabled = visible;
		}

		HideUnsetOrderDisplays();
	}
}
