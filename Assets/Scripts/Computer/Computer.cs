using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Computer : MonoBehaviour
{
	public static List<Computer> computers;
	
	GScreen screen;
	
	GInterface[] menus = new GInterface[2];	
	INavigation[] navBar = new INavigation[1];	
	
	GInterface[] tables = new GInterface[4];
	
	string buttonName="";

	GInterface editingInterface;
	int editingInterfaceTableIndex;
	Rect editingInterfacePreviousBounds;
	
	bool initDone = false;
	bool clientInitDone = false;
	
	public bool portable = false;

	float lastTruckSpawnTime = 0;
	float truckSpawnDelay = 60;

	public Material mPat;
	public Material mCedric;
	public Material mGrace;
	public GameObject truckPrefab;

	public CashRegister cashRegister;
	
	// Use this for initialization
	void Awake ()
	{				
		screen = GetComponent<GScreen>();	
		screen.computer = this;

		cashRegister = GameObject.Find("!Register").transform.FindChild("RegisterTrigger").GetComponent<CashRegister>();
		
		if(GetComponent<ObjectUsable>()) portable = true;
	}

	void Init ()
	{
		GElement newElement;
		
		///////////////////// TABLE ORDERS /////////////////////////
		
		for(int i=0; i<=4; i++)
		{
			if(i<3)
			{
				// Main content
				tables[i] = screen.CreateInterface(16 + (i*158f), 5, 0.186f, 0.78f);
				tables[i].backgroundColor = Color.white;
				tables[i].zLayer = 0.07f;
				
				// Header
				GElement header = tables[i].CreateElement(-1, -1, 1.02f, 0.16f, ""+ (i+1), false);
				header.textSize = 60;
				header.color = Color.blue;
				header.textColor = Color.white;
				header.zLayer = 0.085f;				
				
				for(int j=0; j<2; j++)
				{
					newElement = tables[i].CreateButton(15, 70 + ((j%2)*140), 0.8f, 0.35f);
					newElement.zLayer = 0.09f;
					newElement.SetColor(new Color(1, 0.85f, 0.85f, 0.05f), "highlight");
					newElement.SetColor(new Color(1, 0.7f, 0.7f, 0.5f), "pressed");
					newElement.SetUseable(false);
				}
			} 
			else if(i==3)
			{
				// Main, 2x content
				tables[i] = screen.CreateInterface(16 + (i*158f), 5, 0.186f * 2, 0.78f);
				tables[i].backgroundColor = Color.white;
				tables[i].zLayer = 0.07f;
				
				// Header
				GElement header = tables[i].CreateElement(-1, -1, 1.01f, 0.16f, ""+ (i+1), false);
				header.textSize = 60;
				header.color = Color.blue;
				header.textColor = Color.white;			
				header.zLayer = 0.085f;
				
				for(int j=0; j<4; j++)
				{
					newElement = tables[i].CreateButton(15 + ((j<2?0:1)*140), 70 + ((j%2)*140), 0.4f, 0.35f);
					newElement.zLayer = 0.09f;
					newElement.SetColor(new Color(1, 0.85f, 0.85f, 0.05f), "highlight");
					newElement.SetColor(new Color(1, 0.7f, 0.7f, 0.5f), "pressed");
					newElement.SetUseable(false);
				}
			}				
		}
		
		///////////////////// MENUS /////////////////////////
		
		///////////// 0 MAIN MENU
		menus[0] = screen.CreateInterface(5, 5, 0.9875f, 0.8f);

		///////////// 1 DELIVERY

		menus[1] = screen.CreateInterface(5, 5, 0.9875f, 0.8f);

		// Add interface elements for deliveries, so players know which truck they're ordering
		for(int i=0; i<3; i++)
		{
			string text = "";
			Color textColor = Color.black;

			switch(i)
			{
			default:
				text = "Meat!";
				textColor = Color.red;
				break;
			case 1:
				text = "Bread!";
				textColor = new Color((160f/255f), (160f/225f), 0);
				break;
			case 2:
				text = "Produce! Cheese‽";
				textColor = new Color(0, (160f/255f), 0);
				break;
			}

			// Selection buttons
			newElement = menus[1].CreateElement((28 * (i+1)) + (221 * (i)), 25, 0.28f, 0.7f, text);
			newElement.SetColor(new Color(1, 1, 1));
			newElement.textSize = 30;
			newElement.textColor = textColor;
			newElement.transform.GetChild(0).transform.localScale += new Vector3(-0.6f,-0.6f,0);
			newElement.transform.GetChild(0).transform.position += new Vector3(0f,-0.07f,0);
			newElement.zLayer = 0.06f;
		}

		// Images!
		for(int i=0; i<3; i++)
		{
			// Selection buttons
			newElement = menus[1].CreateElement((28 * (i+1)) + (221 * (i)), 60, 0.28f, 0.6f, "");

			switch(i)
			{
			default:
				newElement.gameObject.GetComponent<Renderer>().material = mPat;
				break;
			case 1:
				newElement.gameObject.GetComponent<Renderer>().material = mCedric;
				break;
			case 2:
				newElement.gameObject.GetComponent<Renderer>().material = mGrace;
				break;
			}


			newElement.SetColor(new Color(1, 1, 1));
			newElement.zLayer = 0.11f;
		}

		// Add button elements for delivery
		for(int i=0; i<3; i++)
		{
			string text = "";

			switch(i)
			{
			default:
				text = "Patt Paddington";
				break;
			case 1:
				text = "Seedy Cedric";
				break;
			case 2:
				text = "Green Grace";
				break;
			}

			// Selection buttons
			newElement = menus[1].CreateButton((28 * (i+1)) + (221 * (i)), 280, 0.28f, 0.2f, text);
			newElement.SetColor(new Color(1, 1, 1, 1f));
			newElement.SetColor(new Color(0.5f, 1f, 0.5f, 0.98f), "highlight");

			newElement.textColor = new Color(0, (128f/225f), 1);
			newElement.textSize = 60;
			newElement.transform.GetChild(0).transform.localScale += new Vector3(-0.8f,0f,0);
			newElement.transform.GetChild(0).transform.position += new Vector3(0f,-0.15f,0);

			newElement.zLayer = 0.08f;
		}
		menus[1].gameObject.SetActive(false);


		/*
		/////////// 1 SELECT TO EDIT
		menus[1] = screen.CreateInterface(5, 5, 0.9875f, 0.8f);
		
		// Add elements to interface, for tables.
		// elements 0-4 are tables 1, 2, 3, 4, 4.
		for(int i=0; i<=4; i++)
		{
			if(i<3)
			{
				// Selection buttons
				newElement = menus[1].CreateButton(14 + (i*158.5f), 0, 0.186f, 0.975f, "tbl" + (i+1));
				newElement.SetColor(new Color(1, 1, 1, 0.05f));
				newElement.SetColor(new Color(0.5f, 1f, 0.5f, 0.5f), "highlight");
				newElement.HideText();		
				newElement.zLayer = 0.095f;
			} 
			else if(i==3)
			{
				// Selection buttons
				newElement = menus[1].CreateButton(14 + (i*158.5f), 0, 0.186f * 2, 0.975f, "tbl" + (i+1));
				newElement.SetColor(new Color(1, 1, 1, 0.05f));
				newElement.SetColor(new Color(0.5f, 1f, 0.5f, 0.5f), "highlight");
				newElement.HideText();		
				newElement.zLayer = 0.095f;
			}				
		}
		menus[1].gameObject.SetActive(false);

		
		/////////// 2 TABLE EDIT 
		menus[2] = screen.CreateInterface(320, 5, 0.558f, 0.78f);
		menus[2].backgroundColor = Color.white;
		
		newElement = menus[2].CreateElement(-1, -1, 1.02f, 0.16f, "SELECT TO ADD");
		newElement.zLayer = 0.085f;
		newElement.color = Color.blue;
		newElement.textColor = Color.white;
		newElement.textSize = 12;
		newElement.transform.GetChild(0).transform.localScale += new Vector3(0,6,0);
		
		for(int i=0; i<=5; i++)
		{
			newElement = menus[2].CreateButton(15 + ((i%3)*140), 70 + ((i<3?0:1)*140), 0.3f, 0.35f);
			newElement.zLayer = 0.09f;			
			newElement.SetMaterialToFoodLocal(Menu.ItemNames[i]);
			newElement.text = "ADD_" + Menu.ItemNames[i];
			newElement.HideText(true);
		}
		
		menus[2].gameObject.SetActive(false);
		*/

		///////////////////// NAVIGATION BARS /////////////////////////
		
		////////////// 0 Main Navigation bar
		navBar[0] = screen.CreateNavigation(5, 370, 0.9875f, 0.16f);

		for(int i=0; i<=1; i++)
		{
			string description = "";
			
			switch(i)
			{
			case 0: 
				description = "ORDERS";
				break;
			case 1:
				description = "DELIVERY";
				break;
			}
			
			newElement = navBar[0].CreateButton((15*3) + (i*380), 5, 0.380f, 0.8f, description);
			newElement.transform.GetChild(0).transform.localScale += new Vector3(-0.3f,1.6f,0);
			newElement.textColor = Color.black;
			newElement.textSize = 26;
		}	

		/*

		//////////// 1 DELIVERY
		navBar[1] = screen.CreateNavigation(5, 370, 0.9875f, 0.16f);
		
		newElement = navBar[1].CreateElement(197.5f, 5, 0.5f, 0.8f, "Select Delivery");
		newElement.textColor = Color.white;
		newElement.SetColor(Color.blue);
		newElement.transform.GetChild(0).transform.localScale += new Vector3(0,6,0);
		newElement.textSize = 12;
		
		navBar[1].gameObject.SetActive(false);
*/
		/*
		///////// 2 TABLE EDIT NAV
		navBar[2] = screen.CreateNavigation(5, 370, 0.9875f, 0.16f);
		
		newElement = navBar[2].CreateButton(197.5f, 5, 0.5f, 0.8f, "CONFIRM");
		newElement.textColor = Color.blue;
		newElement.transform.GetChild(0).transform.localScale += new Vector3(0,6,0);
		newElement.textSize = 12;
		
		navBar[2].gameObject.SetActive(false);
		*/

		//// Add computer to global list
		if(computers==null)
		{
			computers = new List<Computer>();
		}
		
		computers.Add(this);
		
		initDone = true;
	}
	
	public GElement GetTableElement(int tableNumber, int elementNumber)
	{
		if(tableNumber<3 && elementNumber>1) elementNumber = 1;
		if(tableNumber>3 && elementNumber>3) elementNumber = 3;
		
		return tables[tableNumber--].graphicElements[elementNumber--];
		
		//return tables[GetTableElementIndex(tableNumber, elementNumber)];
	}
	
	int GetTableElementIndex(int tableNumber, int elementNumber)
	{
		tableNumber = Mathf.Min(tableNumber--,0);
		elementNumber = Mathf.Min(elementNumber--,0);
		
		// out of bounds - return max
		if(tableNumber<3 && elementNumber>1) return (tableNumber*2) + 1;
		if(tableNumber>3 || elementNumber>3) return 9;
		// otherwise return normal
		return (tableNumber*2) + elementNumber;
	}
	
	[RPC]
	public void SetButtonDown(string name)
	{
		buttonName = name;	
	}
	
	bool GetButtonDown(string name)
	{
		return buttonName == name;	
	}
	
	[RPC]
	public void SetEditingInterface(int tableIndex)
	{
		if(tableIndex == -1)
		{
			editingInterface = null;
		}
		else
		{	
			editingInterface = tables[tableIndex];
			editingInterfacePreviousBounds = editingInterface.bounds;
			
			print ("old bounds: " + editingInterface.bounds);
		}
	}
	
	[RPC]
	public void SetMenusActive(bool active, int id)
	{		
		menus[id].gameObject.SetActive(active);
		// navBar[id].gameObject.SetActive(active);		
	}

	[RPC]
	public void SetTablesActive(bool active)
	{		
		for(int i=0; i<tables.Length; i++)
		{
			tables[i].gameObject.SetActive(active);
		}
	}
	
	void OnPlayerConnected(NetworkPlayer player)
	{
		GetComponent<NetworkView>().RPC("ClientInit", RPCMode.Others);	
		
		for(int i=0; i<menus.Length; i++)
		{
			GetComponent<NetworkView>().RPC("SyncNetworkViewID", RPCMode.Others, "menus", i, menus[i].GetComponent<NetworkView>().viewID);	
			
			foreach(GElement ge in menus[i].graphicElements)
			{
				GetComponent<NetworkView>().RPC("SyncElementNetworkViewID", RPCMode.Others, "menus", i, menus[i].graphicElements.IndexOf(ge), ge.GetComponent<NetworkView>().viewID);	
			}
			
			GetComponent<NetworkView>().RPC("SyncMenuBounds", RPCMode.Others, "menus", i, menus[i].bounds.x, menus[i].bounds.y, menus[i].bounds.width, menus[i].bounds.height, menus[i].gameObject.activeSelf);
		}
		for(int i=0; i<navBar.Length; i++)
		{
			GetComponent<NetworkView>().RPC("SyncNetworkViewID", RPCMode.Others, "navBar", i, navBar[i].GetComponent<NetworkView>().viewID);
			
			foreach(GElement ge in navBar[i].graphicElements)
			{
				GetComponent<NetworkView>().RPC("SyncElementNetworkViewID", RPCMode.Others, "navBar", i, navBar[i].graphicElements.IndexOf(ge), ge.GetComponent<NetworkView>().viewID);	
			}
			
			GetComponent<NetworkView>().RPC("SyncMenuBounds", RPCMode.Others, "navBar", (int)i, navBar[i].bounds.x, navBar[i].bounds.y, navBar[i].bounds.width, navBar[i].bounds.height, navBar[i].gameObject.activeSelf);
		}
		for(int i=0; i<tables.Length; i++)
		{
			GetComponent<NetworkView>().RPC("SyncNetworkViewID", RPCMode.Others, "tables", i, tables[i].GetComponent<NetworkView>().viewID);
			
			foreach(GElement ge in tables[i].graphicElements)
			{
				GetComponent<NetworkView>().RPC("SyncElementNetworkViewID", RPCMode.Others, "tables", i, tables[i].graphicElements.IndexOf(ge), ge.GetComponent<NetworkView>().viewID);	
			}
			
			GetComponent<NetworkView>().RPC("SyncMenuBounds", RPCMode.Others, "tables", (int)i, tables[i].bounds.x, tables[i].bounds.y, tables[i].bounds.width, tables[i].bounds.height, tables[i].gameObject.activeSelf);
			
			GameObject element;
			if(element = tables[i].transform.FindChild("!Element(Clone)").gameObject)
			{
				GetComponent<NetworkView>().RPC("SyncGameObjectID", RPCMode.Others, "tables", i, "!Element(Clone)", element.GetComponent<NetworkView>().viewID);
			}
			
			foreach(GElement ge in tables[i].graphicElements)
			{
				if(ge.text.Contains("REMOVE_"))
				{
					ge.GetComponent<NetworkView>().RPC("SetText", RPCMode.Others, ge.text, ge.IsTextHidden());
					ge.GetComponent<NetworkView>().RPC("SetMaterialToFood", RPCMode.Others, ge.GetComponent<NetworkView>().viewID, ge.text.Substring(9));
				}
			}
		}
		
		GetComponent<NetworkView>().RPC("SetEditingInterface", RPCMode.Others, editingInterfaceTableIndex);
	}
	
	[RPC]
	void ClientInit()
	{
		if(!clientInitDone)
		{
			Init();	
			print("client init done!");
			clientInitDone = true;
		}
	}
	
	[RPC]
	void SyncGameObjectID(string arrayName, int arrayIndex, string gameobjectName, NetworkViewID NID)
	{
		tables[arrayIndex].transform.FindChild("!Element(Clone)").GetComponent<NetworkView>().viewID = NID;
	}
	
	[RPC]
	void SyncElementNetworkViewID(string arrayName, int arrayIndex, int elementIndex, NetworkViewID NID)
	{
		if(arrayName=="menus")
		{
			menus[arrayIndex].graphicElements[elementIndex].GetComponent<NetworkView>().viewID = NID;
		}
		if(arrayName=="navBar")
		{
			navBar[arrayIndex].graphicElements[elementIndex].GetComponent<NetworkView>().viewID = NID;
		}
		if(arrayName=="tables")
		{
			tables[arrayIndex].graphicElements[elementIndex].GetComponent<NetworkView>().viewID = NID;
		}
	}
	
	[RPC]
	void SyncNetworkViewID(string arrayName, int arrayIndex, NetworkViewID NID)
	{
		if(arrayName=="menus")
		{
			menus[arrayIndex].GetComponent<NetworkView>().viewID = NID;
		}
		if(arrayName=="navBar")
		{
			navBar[arrayIndex].GetComponent<NetworkView>().viewID = NID;
		}
		if(arrayName=="tables")
		{
			tables[arrayIndex].GetComponent<NetworkView>().viewID = NID;
		}
	}
	
	[RPC]
	void SetArrayIndexToInterface(string arrayName, int arrayIndex, NetworkViewID elementNID)
	{
		if(name=="menus")
		{
			menus[arrayIndex] = NetworkView.Find(elementNID).GetComponent<GInterface>();
		}
		if(name=="navBar")
		{
			navBar[arrayIndex] = NetworkView.Find(elementNID).GetComponent<INavigation>();
		}
		if(name=="tables")
		{
			tables[arrayIndex] = NetworkView.Find(elementNID).GetComponent<GInterface>();
		}
	}
	
	[RPC]
	void SyncMenuBounds(string name, int id, float x, float y, float w, float h, bool active)
	{
		if(name=="menus")
		{
			menus[id].bounds.x = x;
			menus[id].bounds.y = y;
			menus[id].bounds.width = w;
			menus[id].bounds.height = h;
			menus[id].gameObject.SetActive(active);
		}
		if(name=="navBar")
		{
			navBar[id].bounds.x = x;
			navBar[id].bounds.y = y;
			navBar[id].bounds.width = w;
			navBar[id].bounds.height = h;
			navBar[id].gameObject.SetActive(active);
		}
		if(name=="tables")
		{
			tables[id].bounds.x = x;
			tables[id].bounds.y = y;
			tables[id].bounds.width = w;
			tables[id].bounds.height = h;
			tables[id].gameObject.SetActive(active);
		}
	}

	// Table index starts at 0
	public void AddFoodToTable(int table, string food)
	{
		for(int i=0; i<tables[table].graphicElements.Count; i++)
		{
			if(tables[table].graphicElements[i].text=="" || i == tables[table].graphicElements.Count-1)
			{
				tables[table].graphicElements[i].GetComponent<NetworkView>().RPC("SetMaterialToFood", RPCMode.All, tables[table].graphicElements[i].GetComponent<NetworkView>().viewID, food);
				tables[table].graphicElements[i].GetComponent<NetworkView>().RPC("SetText", RPCMode.All, "REMOVE_" + i + "_" + food, false);
				break;
			}
		}
	}

	public void ClearFoodFromTable(int table, string food)
	{
		for(int i=0; i<tables[table].graphicElements.Count; i++)
		{
			if(tables[table].graphicElements[i].text.Contains(food))
			{
				tables[table].graphicElements[i].GetComponent<NetworkView>().RPC("ResetMaterial", RPCMode.All, tables[table].graphicElements[i].GetComponent<NetworkView>().viewID);
				tables[table].graphicElements[i].GetComponent<NetworkView>().RPC("SetText", RPCMode.All, "", true);

				break;
			}
		}
	}


	// Update is called once per frame
	void Update ()
	{
		if(!initDone && Network.peerType == NetworkPeerType.Server)
		{
			initDone = true;
			Init();
		}
		
		if(initDone || clientInitDone)
		{
			if(!buttonName.Equals("")) print ("Pressed '" + buttonName +"'");

			// DISABLE BUTTON
			if(GetButtonDown("ORDERS"))
			{
				// SHOW 0MAIN, HIDE 1DELIVERY		
				if(Network.isServer)
				{
					GetComponent<NetworkView>().RPC("SetTablesActive", RPCMode.All, true);

					GetComponent<NetworkView>().RPC("SetMenusActive", RPCMode.All, true, 0);
					GetComponent<NetworkView>().RPC("SetMenusActive", RPCMode.All, false, 1);
				}
			}
			if(GetButtonDown("DELIVERY"))
			{
				// HIDE 0MAIN, SHOW 1DELIVERY		
				if(Network.isServer)
				{
					GetComponent<NetworkView>().RPC("SetTablesActive", RPCMode.All, false);

					GetComponent<NetworkView>().RPC("SetMenusActive", RPCMode.All, false, 0);
					GetComponent<NetworkView>().RPC("SetMenusActive", RPCMode.All, true, 1);
				}
			}

			if(buttonName.Contains("Patt Paddington") || buttonName.Contains("Seedy Cedric") || buttonName.Contains("Green Grace"))
			{
				// HIDE 0MAIN, SHOW 1DELIVERY	
				if(Network.isServer)
				{
					if(lastTruckSpawnTime == 0 || Time.time > truckSpawnDelay + lastTruckSpawnTime)
					{
						GameObject newTruck = Network.Instantiate(truckPrefab, GameObject.Find("!TruckSPAWN").transform.position, Quaternion.identity * Quaternion.Euler(0, 270, 0), 1) as GameObject;

						int newContents = 0;
						switch(buttonName)
						{
						case "Patt Paddington":
							newContents = 0;
							break;
						case "Seedy Cedric":
							newContents = 1;
							break;
						case "Green Grace":
							newContents = 2;
							break;
						default:
							newContents = 0;
							break;
						}

						cashRegister.RefreshDisplay(-20);

						newTruck.GetComponent<TruckDriving>().contents = newContents;
						lastTruckSpawnTime = Time.time;
					}
				}
			}

			/*
			if(buttonName.Contains("tbl"))
			{
				int tableIndex = int.Parse(buttonName.Substring(3)) - 1;
				
				editingInterfaceTableIndex = tableIndex;
				editingInterface = tables[tableIndex];
				editingInterfacePreviousBounds = editingInterface.bounds;
				
				// Set new bounds
				if(tableIndex<=2) editingInterface.bounds = tables[0].bounds;
				else editingInterface.bounds = new Rect(tables[0].bounds.x, tables[0].bounds.y, editingInterface.bounds.width, editingInterface.bounds.height);
					
				foreach(GElement ge in editingInterface.graphicElements)
				{
					if(ge.text!="") ge.SetUseable(true);
				}
				
				for(int i=0; i<editingInterface.graphicElements.Count; i++)
				{
					editingInterface.graphicElements[i].SetUseable(true);	
				}
				
				// Disable all other table displays
				for(int i=0; i<tables.Length; i++)
				{
					if(i!=tableIndex) tables[i].gameObject.SetActive(false);
				}
				
				if(Network.isServer)
				{
					networkView.RPC("SetMenusActive", RPCMode.All, false, 1);
					networkView.RPC("SetMenusActive", RPCMode.All, true, 2);
				}
			}
			*/
			
			if(buttonName.Contains("ADD_"))
			{				
				string burgerName = buttonName.Substring(4);
				
				for(int i=0; i<editingInterface.graphicElements.Count; i++)
				{
					if(editingInterface.graphicElements[i].text=="" || i == editingInterface.graphicElements.Count-1)
					{
						if(Network.isServer)
						{
							editingInterface.graphicElements[i].GetComponent<NetworkView>().RPC("SetText", RPCMode.All, "REMOVE_" + i + "_" + burgerName, false);
							editingInterface.graphicElements[i].GetComponent<NetworkView>().RPC("SetMaterialToFood", RPCMode.All, editingInterface.graphicElements[i].GetComponent<NetworkView>().viewID, burgerName);
						}
						break;
					}
				}
			}		
			
			if(buttonName.Contains("REMOVE_"))
			{
				print (buttonName + " ->> " + buttonName.Substring(7, 1));
				
				int buttonIndex = int.Parse( buttonName.Substring(7, 1) );

				if(Network.isServer)
				{
					editingInterface.graphicElements[buttonIndex].GetComponent<NetworkView>().RPC("SetText", RPCMode.All, "", true);
					editingInterface.graphicElements[buttonIndex].GetComponent<NetworkView>().RPC("ResetMaterial", RPCMode.All, editingInterface.graphicElements[buttonIndex].GetComponent<NetworkView>().viewID);
				}
			}	

			/*
			if(buttonName.Contains("CONFIRM"))
			{
				print ("Move " + editingInterface.bounds + " to " + editingInterfacePreviousBounds);
				
				editingInterface.bounds = editingInterfacePreviousBounds;
				
				for(int i=0; i<editingInterface.graphicElements.Count; i++)
				{
					editingInterface.graphicElements[i].SetUseable(false);	
					editingInterface.graphicElements[i].SetColor();
				}
				
				// Enable all other table displays
				for(int i=0; i<tables.Length; i++)
				{
					tables[i].gameObject.SetActive(true);
				}
				
				editingInterfaceTableIndex = -1;
				editingInterface = null;
				
				if(Network.isServer)
				{
					networkView.RPC("SetMenusActive", RPCMode.All, false, 2);
					networkView.RPC("SetMenusActive", RPCMode.All, true, 0);	
				
					for(int i=0; i<menus.Length; i++)
					{
						networkView.RPC("SyncMenuBounds", RPCMode.Others, "menus", i, menus[i].bounds.x, menus[i].bounds.y, menus[i].bounds.width, menus[i].bounds.height, menus[i].gameObject.activeSelf);
					}
				}
			}
			*/
			
			SetButtonDown("");
		}
	}
}
