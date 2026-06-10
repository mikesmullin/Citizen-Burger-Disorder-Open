using UnityEngine;
using System.Collections;

public class TableNodes : MonoBehaviour {
	
	public Table table;
	public bool occupied = false;
	public NPC occupiedBy = null;
	
	// order timekeeping
	public float occupiedStartTime = 0; // Time this table was occupied
	
	// Use this for initialization
	void Awake () {
		if(table==null)
		{
			float dist = 99999;
			GameObject closestTable;
			
			foreach(GameObject t in GameObject.FindGameObjectsWithTag("Table"))
			{
				if( (transform.position - t.transform.position).magnitude < dist)
				{
					dist = (transform.position - t.transform.position).magnitude;
					closestTable = t;
					table = closestTable.GetComponent<Table>();
				}
			}
			
			table.myTableNode = this;
		}
	}

	public void SetTableOccupied(bool occ, NPC who)
	{
		if(Network.isServer)
		{
			if(occ)
				GetComponent<NetworkView>().RPC("SetOccupied", RPCMode.All, who.GetComponent<NetworkView>().viewID, this.GetComponent<NetworkView>().viewID);
			else
				GetComponent<NetworkView>().RPC("SetUnoccupied", RPCMode.All, this.GetComponent<NetworkView>().viewID);
		}
	}

	[RPC]
	void SetOccupied(NetworkViewID whoTarger, NetworkViewID target)
	{
		TableNodes t = NetworkView.Find(target).transform.GetComponent<TableNodes>();
		NPC who = NetworkView.Find(whoTarger).GetComponent<NPC>();

		t.occupiedBy = who;
		t.table.npcAtTable = who;
		t.occupied = true;
		t.occupiedStartTime = Time.time;
	}

	[RPC]
	void SetUnoccupied(NetworkViewID target)
	{
		TableNodes t = NetworkView.Find(target).transform.GetComponent<TableNodes>();
		
		t.occupiedBy = null;
		t.table.npcAtTable = null;
		t.occupied = false;
		t.occupiedStartTime = Time.time;
	}
}
