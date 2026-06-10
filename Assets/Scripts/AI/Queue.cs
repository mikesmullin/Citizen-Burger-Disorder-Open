using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

public class Queue : MonoBehaviour {

	public static List<Queue> NodesInQueue = new List<Queue>();
	public int queueID = -1;
	public bool occupied = false;
	public NPC occupiedBy;

	// Use this for initialization
	void Start ()
	{
		NodesInQueue.Add(this);
		if(queueID == -1)
		{
			queueID = NodesInQueue.Count-1;
			print ("WARNING: Queue ID was unset, so it was set to " + queueID);
		}

		NodesInQueue = NodesInQueue.OrderBy(Queue=>Queue.queueID).ToList();
	}

	
	public int CompareTo(Queue compareQueue)
	{
		// A null value means that this object is greater. 
		if (compareQueue == null)
			return 1;
		
		else 
			return this.queueID.CompareTo(compareQueue.queueID);
	}

	public void SetOccupied(bool o, NPC who)
	{
		occupied = o;

		if(o)
		{
			occupiedBy = who;

			if(who.debug) print ("Queue " + queueID + " is now occupied by " + who.NPCName);
		}
		else
		{
			occupiedBy = null;

			int nodeIndex = NodesInQueue.IndexOf(this);

			if(NodesInQueue.Count>nodeIndex+1 && NodesInQueue[nodeIndex+1]!=null)
			{
				if(NodesInQueue[nodeIndex+1].occupiedBy!=null)
				{
					/*
					print ("Queue " + queueID + " wants to move Q" +
					       (nodeIndex+1) + " owner " + NodesInQueue[nodeIndex+1].occupiedBy.NPCName +
					       " up in the queue.");
*/
					NodesInQueue[nodeIndex+1].occupiedBy.MoveUpInQueue();
				}
			}
		}
	}
}
