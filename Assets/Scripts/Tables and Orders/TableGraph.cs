using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class TableGraph : MonoBehaviour {
	
	public List<TableNodes> nodes = new List<TableNodes>();
	public static TableGroup[] tables;
	
	// A "TableGroup" is a group of table nodes and 'mats'.
	// A "mat" is a location on the table where the game will register a plate of food being placed.
	public class TableGroup
	{
		public int capacity;
		
		public List<Table> tableMats;
		public List<TableNodes> tableNodes;
	}
	
	// Use this for initialization
	void Start ()
	{
		int highestTableNumber = 0;
		
		foreach(Transform t in transform)
		{
			TableNodes thisTable = t.GetComponent<TableNodes>();
			nodes.Add(thisTable);
			
			if(highestTableNumber<thisTable.table.tableNumber)
			{
				highestTableNumber = thisTable.table.tableNumber;	
			}		
		}	
		
		tables = new TableGroup[highestTableNumber];
		for(int i = 0; i<tables.Length; i++)
		{
			tables[i] = new TableGroup();
			tables[i].capacity = 0;
			tables[i].tableMats = new List<Table>();
			tables[i].tableNodes = new List<TableNodes>();
		}
		
		foreach(TableNodes node in nodes)
		{
			int indexToAddAt = node.table.tableNumber-1;
			tables[indexToAddAt].tableNodes.Add(node);
			tables[indexToAddAt].tableMats.Add(node.table);
			tables[indexToAddAt].capacity++;
		}
	}
	
	/// <summary>
	/// Gets the capacity of table.
	/// </summary>
	/// <returns>
	/// The capacity of table.
	/// </returns>
	/// <param name='tableNumber'>
	/// The (non-index) number of the table.
	/// </param>
	int GetCapacityOfTable(int tableNumber)
	{
		return tables[tableNumber-1].capacity;	
	}

	public static bool GetIfTableOccupied(int tableNumber)
	{
		foreach(TableNodes tn in tables[tableNumber].tableNodes)
		{
			if(tn.occupied)
			{
				return true;
			}
		}

		return false;
	}

	public static int FindAnyTableForGroup(int groupSize)
	{
		if(tables!=null)
		{
			int rand = Random.Range(0, tables.Length);
			
			for(int i=0; i<tables.Length; i++)
			{
				int tableNum = (i + rand) % tables.Length;
				//	print ("Table " + (tableNum+1) + " has a capacity of: " + tables[tableNum].capacity);
				
				if(tables[tableNum].capacity == groupSize)
				{
					return tableNum+1;
				}
			}
		}
		
		// no tables have been found
		return -1;
	}
	
	public static int FindUnoccupiedTableForGroup(int groupSize)
	{
		if(tables!=null)
		{
			int rand = Random.Range(0, tables.Length);

			for(int i=0; i<tables.Length; i++)
			{
				int tableNum = (i + rand) % tables.Length;

			//	print ("Table " + (tableNum+1) + " has a capacity of: " + tables[tableNum].capacity);
				
				if(tables[tableNum].capacity == groupSize)
				{
				//	print ("The group of " + groupSize + " can fit here");
					
					bool occupied = false;
					
					foreach(TableNodes node in tables[tableNum].tableNodes)
					{
						if(node.occupied)
						{
					//		print ("... but the table is already occupied.");
							
							occupied = true;
							break;
						}
					}
					
					if(!occupied)
					{					
						return tableNum+1;
					}
				}
			}

			// do one more loop, the key difference is that groups will now try to go on unoccupied tables that have a greater capacity than the group's size
			// (this is worse for players as it is inefficient to have a group of 2 on a table that can otherwise seat 4)

			for(int i=0; i<tables.Length; i++)
			{
				int tableNum = (i + rand) % tables.Length;
				
				print ("Table " + (tableNum+1) + " has a capacity of: " + tables[tableNum].capacity);
				
				if(tables[tableNum].capacity >= groupSize)
				{
					print ("The group of " + groupSize + " can fit here");
					
					bool occupied = false;
					
					foreach(TableNodes node in tables[tableNum].tableNodes)
					{
						if(node.occupied)
						{
							print ("... but the table is already occupied.");
							
							occupied = true;
							break;
						}
					}
					
					if(!occupied)
					{					
						return tableNum+1;
					}
				}
			}
		}

		// no tables have been found
		return -1;
	}
}
