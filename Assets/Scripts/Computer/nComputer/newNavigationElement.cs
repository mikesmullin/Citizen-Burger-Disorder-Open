using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;

public class newNavigationElement : MonoBehaviour
{
	public newNavigationElement MoveToOnConfirm;
	public newNavigationElement MoveToOnReturn;
	public bool MovesOnHorizontalInput = true;
	public bool canModifyTextAsInt = false;

	public Text elementDisplayText;

	public ElementNumber number;

	public Sprite backgroundSpriteForCanvas;

	public enum ThingThisThingDoes
	{
		Nothing = 0,
		AddBurgerToOrder,
		AddTableNumberToOrder,
		ConfirmOrder,
		ResetOrder
	}
	public ThingThisThingDoes thisThingDoes;

	// Use this for initialization
	void Awake ()
	{
		if(GetComponent<ElementNumber>()) number = GetComponent<ElementNumber>();

		if(!MoveToOnConfirm)
		{
			if(transform.childCount>0)
			{
				foreach(Transform t in transform)
				{
					if(t.GetComponent<newNavigationElement>())
					{
						MoveToOnConfirm = t.GetComponent<newNavigationElement>();
						break;
					}
				}
			}
		}
		if(!MoveToOnReturn)
		{
			if(transform.parent!=null && transform.parent.GetComponent<newNavigationElement>())
			{
				MoveToOnReturn = transform.parent.GetComponent<newNavigationElement>();
			}
		}
	}
	
	public void ConfirmThisElement()
	{
		if(thisThingDoes == ThingThisThingDoes.AddBurgerToOrder)
		{
			transform.parent.GetComponent<ElementCreateOrderOverview>().AddToOrder(this.name);
		}
		else if(thisThingDoes == ThingThisThingDoes.AddTableNumberToOrder)
		{
			//MoveToOnConfirm.elementDisplayText.text = GetComponent<Text>().text;

			int tableNo = -1;

			if(int.TryParse(GetComponent<Text>().text, out tableNo))
			{
				ElementCreateOrderOverview.OrderCreateComputer.currentTableID = tableNo;
			}
			else
			{
				print ("No table number!");
			}
		}
		else if(thisThingDoes == ThingThisThingDoes.ConfirmOrder)
		{
			if(ElementCreateOrderOverview.OrderCreateComputer)
			{
				List<string> currentOrder = ElementCreateOrderOverview.OrderCreateComputer.CurrentOrder;

				int orderCount = 0;
				foreach(string s in currentOrder)
				{
					if(s.Length>1) orderCount++;
				}

				int tableNumber = ElementViewOrderOverview.OrderDisplayComputer[0].GetFreeTableID(orderCount);

				if(currentOrder.Count>0)
				{
					for(int i=0; i<currentOrder.Count; i++)
					{
						for(int j=0; j<ElementViewOrderOverview.OrderDisplayComputer.Count; j++)
						{
							ElementViewOrderOverview.OrderDisplayComputer[j].AddToOrder(tableNumber, currentOrder[i]);
						}
					}
				}

				// Is there actually an NPC in the queue?
				if(ElementCreateOrderOverview.OrderCreateComputer.npcInQueue)
				{
					NPC n = ElementCreateOrderOverview.OrderCreateComputer.npcInQueue;
					n.SetWants((int)NPC.wants.toGetNumberStand);
					n.DestroyAllSpeechBubbles();
					n.AddSpeechBubble("NumberStand");
				}

				ElementCreateOrderOverview.OrderCreateComputer.ResetAllCurrentOrders();
			}
		}
		else if(thisThingDoes == ThingThisThingDoes.ResetOrder)
		{
			ElementCreateOrderOverview.OrderCreateComputer.ResetAllCurrentOrders();
		}
	}

	void OnEnable()
	{
		ToggleVisible(true);
	}

	void OnDisable()
	{
		ToggleVisible(false);
	}

	void ToggleVisible(bool visible)
	{
		if(GetComponent<Image>()) GetComponent<Image>().enabled = visible;
		if(elementDisplayText!=null) elementDisplayText.enabled = visible;
		if(GetComponent<Text>()) GetComponent<Text>().enabled = visible;
		if(GetComponent<ElementCreateOrderOverview>()) GetComponent<ElementCreateOrderOverview>().enabled = visible;
		if(GetComponent<ElementViewOrderOverview>()) GetComponent<ElementViewOrderOverview>().enabled = visible;

		foreach(Transform t in transform)
		{
			if(t.GetComponent<newSubNavElementGraphic>())
			{
				t.GetComponent<newSubNavElementGraphic>().enabled = visible;
			}
		}
	}

	public void IncrementDisplayNumber(int amount = 1)
	{
		number.ChangeValue(number.value + amount);
	}

	public void ChangeDisplayNumber(int newNumber)
	{
		number.ChangeValue(newNumber);
	}
}
