using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;

public class ElementViewOrderOverview : MonoBehaviour {

	public static List<ElementViewOrderOverview> OrderDisplayComputer = new List<ElementViewOrderOverview>();

	public List<string> Table1 = new List<string>();
	public List<string> Table2 = new List<string>();
	public List<string> Table3 = new List<string>();
	public List<string> Table4 = new List<string>();

	public List<Image> TableObj1 = new List<Image>();
	public List<Image> TableObj2 = new List<Image>();
	public List<Image> TableObj3 = new List<Image>();
	public List<Image> TableObj4 = new List<Image>();

	int tableIndex1 = 0;
	int tableIndex2 = 0;
	int tableIndex3 = 0;
	int tableIndex4 = 0;

	// Use this for initialization
	void Awake ()
	{
		OrderDisplayComputer.Add(this);
		ResetAllCurrentOrders();
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Input.GetKeyDown(KeyCode.Alpha0))
		{
			AddToOrder(Random.Range(1,5), Menu.ItemNames[Random.Range(0, Menu.Items.Length)]);
			print ("Yolo!");
		}
		
		if(Input.GetKeyDown(KeyCode.Alpha9))
		{
			ResetAllCurrentOrders();
		}
	}

	void OnEnable()
	{
		ToggleCurrentOrderDisplay(true);
	}
	
	void OnDisable()
	{
		ToggleCurrentOrderDisplay(false);
	}

	public int GetFreeTableID(int orderSize)
	{
		List<int> possibleTables = new List<int>();

		if(orderSize<3)
		{
			if(tableIndex1==0) possibleTables.Add(1);
			if(tableIndex2==0) possibleTables.Add(2);
			if(tableIndex3==0) possibleTables.Add(3);

			if(possibleTables.Count==0 && tableIndex4==0)
			{
				possibleTables.Add(4);
			}
		}
		else
		{
			if(tableIndex4==0) possibleTables.Add(4);
		}

		if(possibleTables.Count==0)
		{
			print("ERROR: NO POSSIBLE TABLES FOUND. ALL TABLES FULL.");
			return -1;
		}

		return possibleTables[Random.Range(0, possibleTables.Count-1)];
	}

	public void AddToOrder(int table, string foodName)
	{
		if(foodName == "") return;

	//	print ("Adding " + foodName + " to table " + table);

		if(table==1)
		{
			if(tableIndex1<2)
			{
				Table1[tableIndex1] = foodName;
				TableObj1[tableIndex1].sprite = Menu.GetFoodSprite(foodName);
				if(enabled) TableObj1[tableIndex1].enabled = true;

				tableIndex1++;
			}
		}
		if(table==2)
		{
			if(tableIndex2<2)
			{
				Table2[tableIndex2] = foodName;
				TableObj2[tableIndex2].sprite = Menu.GetFoodSprite(foodName);
				if(enabled) TableObj2[tableIndex2].enabled = true;

				tableIndex2++;
			}
		}
		if(table==3)
		{
			if(tableIndex3<2)
			{
				Table3[tableIndex3] = foodName;
				TableObj3[tableIndex3].sprite = Menu.GetFoodSprite(foodName);
				if(enabled) TableObj3[tableIndex3].enabled = true;

				tableIndex3++;
			}
		}
		if(table==4)
		{
			if(tableIndex4<4)
			{
				Table4[tableIndex4] = foodName;
				TableObj4[tableIndex4].sprite = Menu.GetFoodSprite(foodName);
				if(enabled) TableObj4[tableIndex4].enabled = true;

				tableIndex4++;
			}
		}
	}

	void ResetAllCurrentOrders()
	{
		tableIndex1=0;
		tableIndex2=0;
		tableIndex3=0;
		tableIndex4=0;

		Table1.Clear();
		for(int i=0; i<2; i++)
		{
			Table1.Add("");
			
			TableObj1[i].sprite = null;
			TableObj1[i].enabled = false;
		}

		Table2.Clear();
		for(int i=0; i<2; i++)
		{
			Table2.Add("");
			
			TableObj2[i].sprite = null;
			TableObj2[i].enabled = false;
		}

		Table3.Clear();
		for(int i=0; i<2; i++)
		{
			Table3.Add("");
			
			TableObj3[i].sprite = null;
			TableObj3[i].enabled = false;
		}

		Table4.Clear();
		for(int i=0; i<4; i++)
		{
			Table4.Add("");
			
			TableObj4[i].sprite = null;
			TableObj4[i].enabled = false;
		}
	}

	void ResetAllCurrentOrders(int tableToReset)
	{
		if(tableToReset==1)
		{
			tableIndex1=0;
			
			Table1.Clear();
			for(int i=0; i<2; i++)
			{
				Table1.Add("");
				
				TableObj1[i].sprite = null;
				TableObj1[i].enabled = false;
			}
		}

		if(tableToReset==2)
		{
			tableIndex2=0;

			Table2.Clear();
			for(int i=0; i<2; i++)
			{
				Table2.Add("");
				
				TableObj2[i].sprite = null;
				TableObj2[i].enabled = false;
			}
		}

		if(tableToReset==3)
		{
			tableIndex3=0;

			Table3.Clear();
			for(int i=0; i<2; i++)
			{
				Table3.Add("");
				
				TableObj3[i].sprite = null;
				TableObj3[i].enabled = false;
			}
		}

		if(tableToReset==4)
		{
			tableIndex4=0;
			Table4.Clear();
			for(int i=0; i<4; i++)
			{
				Table4.Add("");
				
				TableObj4[i].sprite = null;
				TableObj4[i].enabled = false;
			}
		}
	}

	void ToggleCurrentOrderDisplay(bool visible)
	{
		foreach(Image i in TableObj1)
		{
			i.enabled = visible;
		}
		foreach(Image i in TableObj2)
		{
			i.enabled = visible;
		}
		foreach(Image i in TableObj3)
		{
			i.enabled = visible;
		}foreach(Image i in TableObj4)
		{
			i.enabled = visible;
		}

		HideUnsetOrderDisplays();
	}

	void HideUnsetOrderDisplays()
	{
		foreach(Image i in TableObj1)
		{
			int index = TableObj1.IndexOf(i);
			
			if(Table1[index]=="")
			{
				i.enabled = false;
			}
		}
		foreach(Image i in TableObj2)
		{
			int index = TableObj2.IndexOf(i);
			
			if(Table2[index]=="")
			{
				i.enabled = false;
			}
		}
		foreach(Image i in TableObj3)
		{
			int index = TableObj3.IndexOf(i);
			
			if(Table3[index]=="")
			{
				i.enabled = false;
			}
		}
		foreach(Image i in TableObj4)
		{
			int index = TableObj4.IndexOf(i);
			
			if(Table4[index]=="")
			{
				i.enabled = false;
			}
		}
	}
}
