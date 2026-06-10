using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class NPC : MonoBehaviour {

	public string NPCName = "NPC";

	public static List<NPC> CurrentNPCs = new List<NPC>();

	public float anger = 0;
	float angerBeforeLeaving = 100f;
	Color materialStartColour;
	public Color currentUnmodifiedColour;

	float angerDamage = 15f;

	float panicRotateAmount = 2;
	float panicSpeedModifier = 1;

	float currentSpeed = 100;
	float maxSpeed = 120;
	float maxIndoorSpeed = 95f;
	float currentMaxSpeed = 120;

	public float seekDesire = 1f;
	public float avoidLocalDesire = 1.2f;
	public float avoidNPCDesire = 0.5f;

	LocalObjectDetection localDetect;
	GraphScript graph;

	public List<NavigationScript> pathToFollow = new List<NavigationScript>();
	Vector3 GoalPosition = Vector3.zero;
	bool movementOrganisedByCurrentWant = false;

	Vector3 suggestedDirection = Vector3.zero;
	float suggestedDirectionDuration = 0.5f;
	float suggestedMoveStartTime = 0;

	public TableGraph tableGraph;
	public TableNodes seat;
	public bool inside = false;	
	public string desiredFood = "";

	int queuePositionID = -1;

	public List<SpeechBubble> mySpeechBubbles = new List<SpeechBubble>();

	public int desiredGroupSize = 2;
	public List<NPC> myNPCGroup = new List<NPC>();
	public NPC myNPCGroupLeader;

	public GameObject holding = null;

	int layerMask = ~((1<<8) | (1<<12) | (1<<13) | (1<<14));
	int pathfindLayerMask =  ~((1<<8) | (1<<12) | (1<<13) | (1<<14) | (1<<15));
	
	float waitDuration = 0;
	float waitStartTime = 0;

	public NPC interactWithThisNPC;

	public enum wants // One of the first two wants are picked randomly at spawn - exitScene and enter (restaraunt)
	{
		toExitScene,
		toEnter,
		toGetToSeat,
		toQueue,
		toPlaceOrder,
		toGetNumberStand,
		toGetFood,
		toLeave,
		toEat,
		toIdle,
		toFight,
		toPanicBecauseFire,
		toWanderRestaurant,
		toFollowLeader
	}
	public wants currentlyWants;
	public wants previouslyWanted;

	public bool debug = false;

	void OnPlayerConnected(NetworkPlayer player)
	{
		GetComponent<NetworkView>().RPC("SyncPosition", RPCMode.Others, transform.position, transform.rotation);
		if(GetComponent<Rigidbody>()) GetComponent<NetworkView>().RPC("SyncRigidbody", RPCMode.Others, GetComponent<Rigidbody>().velocity, GetComponent<Rigidbody>().angularVelocity);
	}
	
	[RPC]
	void SyncPosition(Vector3 pos, Quaternion rot)
	{
		transform.position = pos;
		transform.rotation = rot;
	}
	
	[RPC]
	void SyncRigidbody(Vector3 vel, Vector3 aVel)
	{
		if(!GetComponent<Rigidbody>()) gameObject.AddComponent<Rigidbody>();
		
		GetComponent<Rigidbody>().velocity = vel;
		GetComponent<Rigidbody>().angularVelocity = aVel;
	}
	
	[RPC]
	void SyncWants(int currentlyWantsID, int previouslyWantsID)
	{
		currentlyWants = (wants)currentlyWantsID;
	}
	
	// Use this for initialization
	void Start ()
	{		
		graph = GameObject.Find("!NavigationGraph").GetComponent<GraphScript>();
		tableGraph = GameObject.Find("!TableNodes").GetComponent<TableGraph>();
		localDetect = transform.GetChild(0).GetComponent<LocalObjectDetection>();
		materialStartColour = GetComponent<Renderer>().material.color;
		currentUnmodifiedColour = materialStartColour;

		panicRotateAmount = Random.Range(1.8f, 3f);
		if(Random.value>0.5f) panicRotateAmount = -panicRotateAmount;

		panicSpeedModifier = Random.Range(0.8f, 1.2f);

		CurrentNPCs.Add(this);

		angerDamage = Random.Range(10,25);
	}
	
	// Update is called once per frame
	void Update ()
	{
		if(Network.isServer)
		{
			if(GetComponent<Renderer>() && GetComponent<Renderer>().material)
			{
				GetComponent<Renderer>().material.color = Color.Lerp(currentUnmodifiedColour, Color.red, anger*0.004f);
			}

			if(GetComponent<Flamable>().isOnFire && currentlyWants != wants.toPanicBecauseFire)
			{
				currentUnmodifiedColour = Color.Lerp(
					GetComponent<Renderer>().material.color,
					Color.black,
					0.8f);
				
				SetWants((int)wants.toPanicBecauseFire);
			}

			if(anger>angerBeforeLeaving && currentlyWants!=wants.toLeave)
			{
				ClearGoal();
				DestroyAllSpeechBubbles();
				if(seat) seat.SetTableOccupied(false, this);

				interactWithThisNPC = null;
				SetWants((int)wants.toLeave);
			}

			if(myNPCGroup.Count == 0 && myNPCGroupLeader!=null)
			{
				UpdateGroupMembers();
			}

			if(inside) currentMaxSpeed = maxIndoorSpeed;
			else currentMaxSpeed = maxSpeed;

			// NPC WANTS
			switch(currentlyWants)
			{
			case wants.toEnter:
				WantsToEnter();
				break;
			case wants.toQueue:
				WantsToQueue();
				break;
			case wants.toPlaceOrder:
				WantsToPlaceOrder();
				break;
			case wants.toGetToSeat:
				WantsToGetToSeat();
				break;
			case wants.toWanderRestaurant:
				WantsToWanderRestaurant();
				break;
			case wants.toGetNumberStand:
				WantsToGetNumberStand();
				break;
			case wants.toGetFood:
				WantsToGetFood();
				break;
			case wants.toEat:
				WantsToEat();
				break;
			case wants.toIdle:
				WantsToIdle();
				break;
			case wants.toPanicBecauseFire:
				WantsToPanicBecauseFire();
				break;
			case wants.toFight:
				WantsToFight();
				break;
			case wants.toLeave:
				WantsToLeave();
				break;
			case wants.toExitScene:
				WantsToExitScene();
				break;
			}

			Movement();

			if(currentSpeed!=currentMaxSpeed && localDetect.ObjectsToAvoid.Count == 0)
			{
				currentSpeed = Mathf.Lerp(currentSpeed, currentMaxSpeed, 0.07f * Time.deltaTime);
			}
		}
	}

	void LateUpdate()
	{
		if(holding)
		{
			if(currentlyWants == wants.toEat)
			{	
				// JUST A COMPLETE FUCKING MESS OF PROGRAMMER ANIMATION, COMPLETELY IGNORE THIS OR REWRITE IT OR SOMETHING, CHRIST
				holding.GetComponent<Rigidbody>().velocity = Vector3.zero;
				holding.GetComponent<Rigidbody>().angularVelocity = Vector3.zero;

				float pickingUpFoodspeed = 2.5f;
				float startChewingAt = 0.6f;
				float pickUpFasterAt = 0.3f;
			
				float currentTimeSine = Mathf.Sin(Time.time); 

				float baseY = 1f;
				float objectY = 1.4f; // is also the speed / height which the burger rises? It's weird

				if(currentTimeSine > startChewingAt)
				{
					objectY = (0.2f * (Mathf.Sin(Time.time * currentSpeed * 0.14f))) + baseY;

					holding.transform.localScale = Vector3.Lerp(holding.transform.localScale, new Vector3(1,1,1) * (Mathf.Cos(Time.time * 4f) * 0.1f + 0.9f) , 5 * Time.deltaTime);
				}
				else
				{
					holding.transform.localScale = Vector3.Lerp(holding.transform.localScale, new Vector3(1,1,1), 5 * Time.deltaTime);
				}

				Vector3 goalHoldingPos = Vector3.Lerp(transform.position + transform.up * 1.2f + transform.forward * 3f, transform.position + transform.up * objectY + transform.forward * 1.35f, currentTimeSine * pickingUpFoodspeed);

				holding.transform.position = Vector3.Lerp(holding.transform.position, goalHoldingPos, maxSpeed * 0.05f * Time.deltaTime);

			}
			else
				holding.transform.position = Vector3.Lerp(holding.transform.position, transform.position + transform.up + transform.forward * 2, maxSpeed * 0.05f * Time.deltaTime);
		}
	}

	void Movement()
	{
		if(movementOrganisedByCurrentWant) return;

		if(GoalPosition!=Vector3.zero)
		{
			// Is the NPC's vision to its goal blocked?
			RaycastHit hit;
			if(Physics.Linecast(transform.position, GoalPosition, out hit, pathfindLayerMask))
			{
				// At current path node, remove it
				if(pathToFollow.Count>0 && (transform.position - pathToFollow[0].transform.position).magnitude < 4f)
				{
					pathToFollow.RemoveAt(0);
				}

				if(pathToFollow.Count>0)
				{
					if(Physics.Linecast(transform.position, pathToFollow[0].transform.position, out hit, pathfindLayerMask))
					{
						if(debug)
						{
							Debug.DrawLine(transform.position, pathToFollow[0].transform.position, Color.red, 20f);
							Debug.DrawLine(transform.position, graph.nodes[FindClosestNode(transform.position)].transform.position, Color.yellow, 20f);
						}

						print (NPCName + " can't see path or goal - creating new path");
						pathToFollow = CreatePath(GoalPosition);
					}
					else
					{
						MoveToLocation(pathToFollow[0].transform.position);
					}
				}
				else
				{
					if(debug)
						Debug.DrawLine(transform.position, GoalPosition, Color.red, 4f);

					print ("Can't see goal and there is no longer a path to follow? Creating new path to goal.");
					pathToFollow = CreatePath(GoalPosition);
				}
			}
			else
			{
				// Are we interacting with another NPC? In which case, follow the NPC's position
				if(interactWithThisNPC)
				{
					MoveToLocation(interactWithThisNPC.transform.position);
				}
				else
				{
					// Is there a goal to move towards?
					MoveToLocation(GoalPosition);
				}
			}
		}
		else
		{
			Vector3 directionToLook = transform.forward * 3;

			if(currentlyWants == wants.toIdle || currentlyWants == wants.toQueue)
			{
				directionToLook = transform.forward + transform.right * Mathf.Sin(Time.time) * Time.deltaTime * 0.5f;
			}
			if(currentlyWants == wants.toGetFood)
			{
				directionToLook = (seat.transform.position + seat.transform.forward * 4) - transform.position  + transform.right * Mathf.Sin(Time.time) * Time.deltaTime * 1f;
				Debug.DrawLine(transform.position, directionToLook, Color.red);
			}

			directionToLook.y = 0;

			transform.rotation = Quaternion.Lerp(transform.rotation, Quaternion.LookRotation(directionToLook), 15f * Time.deltaTime);
		}
	}

	void MoveToLocation(Vector3 location)
	{
		Vector3 directionToMove = Vector3.zero;
		Vector3 goalDirectionOnly = Vector3.zero;
		Vector3 directionToLook = Vector3.zero;

		int normalCount = 1;

		goalDirectionOnly += Seek(location) * seekDesire;
		directionToMove += goalDirectionOnly;
		if(currentlyWants != wants.toPlaceOrder && localDetect.ObjectsToAvoid.Count>0)
		{
			directionToMove += AvoidLocal() * avoidLocalDesire;

			if(debug) Debug.DrawLine(transform.position, transform.position + directionToMove.normalized * 5, Color.black);

			normalCount++;
		}
		Vector3 avoidn = AvoidNPCs() * avoidNPCDesire;
		if(avoidn!=Vector3.zero)
		{
			directionToMove += avoidn;
			normalCount++;
		}

		directionToMove /= normalCount;

		if(suggestedMoveStartTime == 0 && Vector3.Angle(goalDirectionOnly, directionToMove)>20)
		{
			suggestedDirection = directionToMove.normalized;
			suggestedMoveStartTime = Time.time;
		}

		if(debug) print ("Difference: " + Vector3.Angle(goalDirectionOnly, directionToMove));

		if(suggestedMoveStartTime==0 && suggestedDirection != Vector3.zero)
		{
			// THIS IS WHERE THE ACTUAL MOVEMENT HAPPENS!
			// I know I made it confusing. :(
			GetComponent<Rigidbody>().AddForce(directionToMove.normalized * currentSpeed * 8f * Time.deltaTime);
		}
		else
		{
			float lerpCompletion = (Time.time - suggestedMoveStartTime) / (suggestedDirectionDuration + 0.001f);
			lerpCompletion = Mathf.Min(lerpCompletion, 1);

			Vector3 actualMoveDirection = Vector3.Lerp(suggestedDirection, directionToMove.normalized, lerpCompletion);

			if(debug) Debug.DrawLine(transform.position, transform.position + directionToMove.normalized * 6, Color.green);
			if(debug) Debug.DrawLine(transform.position, transform.position + actualMoveDirection.normalized * 3, Color.Lerp(Color.black, Color.green, 0.3f));

			GetComponent<Rigidbody>().AddForce(actualMoveDirection.normalized * currentSpeed * 8f * Time.deltaTime);
		
			if(lerpCompletion >= 1)
			{
				suggestedDirection = Vector3.zero;
				suggestedMoveStartTime = 0;
			}
		}

		if(debug)
		{
			Debug.DrawLine(transform.position, transform.position + GetComponent<Rigidbody>().velocity * 4, Color.magenta);
		}

		// THIS IS WHERE LOOKING HAPPENS - most of the time. I think looking happens other places too? Don't ask me.
		if(GetComponent<Rigidbody>().velocity.magnitude > 0.2f)
			directionToLook = GetComponent<Rigidbody>().velocity.normalized;
		else if(currentlyWants == wants.toPlaceOrder || currentlyWants == wants.toQueue || currentlyWants == wants.toGetNumberStand)
		{
			directionToLook = (FirstPersonControl.localPlayer.transform.position - transform.position).normalized;
		}
		else
			directionToLook = directionToMove;
		
		directionToLook.y = 0;	

		transform.rotation = Quaternion.Lerp(transform.rotation, Quaternion.LookRotation(directionToLook + transform.forward), 15f * Time.deltaTime);
	}

	void GenerateFoodOrderForGroup()
	{
		if(Network.isServer && myNPCGroupLeader == this)
		{
			foreach(NPC n in myNPCGroup)
			{
				n.desiredFood = Menu.ItemNames[Random.Range(0, Menu.ItemNames.Length)];

				AddSpeechBubble(n.desiredFood);
			}
		}
	}

	public void AddSpeechBubble(string imageName, bool onlyAppearNearPlayer = false)
	{
		NetworkViewID speechID = Network.AllocateViewID();
		
		GameObject speech = NetworkObjectSpawner.networkSpawner.Create(NetworkObjectSpawner.PrefabList.SpeechBubble,
		                                                               transform.position, transform.rotation,
		                                                               speechID);
		
		SpeechBubble sb = speech.GetComponent<SpeechBubble>();
		sb.UpdateImage(imageName);
		sb.myNPC = this.gameObject;
		sb.SetIndex(mySpeechBubbles.Count);
		sb.appearOnlyWhenPlayerIsNear = onlyAppearNearPlayer;
		
		speech.GetComponent<NetworkView>().RPC("SyncSpeechBubble", RPCMode.Others,
		                                       imageName,
		                                       mySpeechBubbles.Count,
		                                       speechID,
		                                       this.GetComponent<NetworkView>().viewID);
		
		mySpeechBubbles.Add(sb);
	}

	public void PopSpeechBubble(int id)
	{
		NetworkObjectSpawner.networkSpawner.Destroy(mySpeechBubbles[id].GetComponent<NetworkView>().viewID);
	}

	public void DestroyAllSpeechBubbles()
	{
		foreach(SpeechBubble s in mySpeechBubbles)
		{
			NetworkObjectSpawner.networkSpawner.Destroy(s.GetComponent<NetworkView>().viewID);
		}

		mySpeechBubbles.Clear();
	}

	public void DespawnNPC()
	{
		print ("DESTROYING NPC????");
	}

	public void GiveNumberStand(int standNumber, GameObject standObject)
	{
		if(myNPCGroupLeader == this)
		{
			AssignGroupToTable();
			DestroyAllSpeechBubbles();
			GetComponent<NetworkView>().RPC("Grab", RPCMode.All, standObject.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID);
		}
	}

	bool AssignGroupToTable(int tableNo=-1)
	{
		if(tableNo==-1)
		{
			// Pick a table number by algorithm

			int desiredTableNumber = TableGraph.FindUnoccupiedTableForGroup(desiredGroupSize) - 1;
			if(debug) print (NPCName + " will go to table " + desiredTableNumber);
			
			if(desiredTableNumber>=0)
			{
				for(int i=0; i<myNPCGroup.Count; i++)
				{
					myNPCGroup[i].seat = TableGraph.tables[desiredTableNumber].tableNodes[i];
					TableGraph.tables[desiredTableNumber].tableNodes[i].SetTableOccupied(true, myNPCGroup[i]);
					
					myNPCGroup[i].ClearGoal();
					myNPCGroup[i].SetWants((int)wants.toGetToSeat);
					if(myNPCGroup[i].interactWithThisNPC) myNPCGroup[i].interactWithThisNPC = null;
				}
				
				Queue.NodesInQueue[queuePositionID-1].SetOccupied(false, null);

				return true;
			}
			else
			{
				int tableNum = TableGraph.FindAnyTableForGroup(myNPCGroupLeader.desiredGroupSize);

				print ("Finding any table returned " + tableNum);

				for(int i=0; i<myNPCGroup.Count; i++)
				{
					int randomSeat = Random.Range(0, TableGraph.tables[tableNum-1].tableNodes.Count);
					int seatLength = TableGraph.tables[tableNum-1].tableNodes.Count;
					NPC interact = null;

					List<TableNodes> wrappedListTableNodes = TableGraph.tables[tableNum-1].tableNodes.GetRange(randomSeat, seatLength - randomSeat);
					if(randomSeat!=0)
					{
						wrappedListTableNodes.AddRange(TableGraph.tables[tableNum-1].tableNodes.GetRange(0, randomSeat));
					}

					for(int j=0; j<wrappedListTableNodes.Count; j++)
					{
						if(wrappedListTableNodes[j].occupiedBy)
						{
							print ("looking at " + wrappedListTableNodes[j].occupiedBy.NPCName);
							interact = wrappedListTableNodes[j].occupiedBy;
							break;
						}
					}

					myNPCGroup[i].interactWithThisNPC = interact;
					myNPCGroup[i].ClearGoal();
					myNPCGroup[i].SetWants((int)wants.toFight);
				}

				return true;
			}
		}
		else
		{
			// Table number already supplied

			if(!TableGraph.GetIfTableOccupied(tableNo)) // Table is not occupied
			{
				for(int i=0; i<myNPCGroup.Count; i++)
				{
					myNPCGroup[i].seat = TableGraph.tables[tableNo].tableNodes[i];
					TableGraph.tables[tableNo].tableNodes[i].SetTableOccupied(true,myNPCGroup[i]);
					
					myNPCGroup[i].ClearGoal();
					myNPCGroup[i].SetWants((int)wants.toGetToSeat);
				}
				
				Queue.NodesInQueue[queuePositionID-1].SetOccupied(false, null);
				
				return true;
			}
			else // table is occupied
			{
				int randomTable = Random.Range(0, TableGraph.tables.Length);
				
				for(int i=0; i<myNPCGroup.Count; i++)
				{
					int randomSeat = Random.Range(0, TableGraph.tables[randomTable].tableNodes.Count);
					
					myNPCGroup[i].interactWithThisNPC = TableGraph.tables[randomTable].tableNodes[randomSeat].occupiedBy;
					myNPCGroup[i].ClearGoal();
					myNPCGroup[i].SetWants((int)wants.toFight);
				}
				
				return true;
			}
		}

		return false;
	}

	public void UnassignGroupToTable()
	{
		if(myNPCGroupLeader == this)
		{
			foreach(NPC n in myNPCGroup)
			{
				n.seat.SetTableOccupied(false, this);
				n.seat = null;
				if(n!=this)
				{
					n.ClearGoal();
					n.SetWants((int)wants.toLeave);
				}
			}
		}
	}

	[RPC]
	void Grab(NetworkViewID targetObj, NetworkViewID targetNPC)
	{
		GameObject grab = NetworkView.Find(targetObj).gameObject;
		NPC n = NetworkView.Find(targetNPC).GetComponent<NPC>();

		n.holding = grab;
		grab.GetComponent<Rigidbody>().useGravity = false;
		grab.GetComponent<Collider>().enabled = false;
	}

	[RPC]
	void LetGo(NetworkViewID targetObj, NetworkViewID targetNPC, Vector3 pos, Vector3 force)
	{
		GameObject ungrab = NetworkView.Find(targetObj).gameObject;
		NPC n = NetworkView.Find(targetNPC).GetComponent<NPC>();
		
		n.holding = null;
		ungrab.transform.position = pos;
		ungrab.GetComponent<Rigidbody>().useGravity = true;
		ungrab.GetComponent<Collider>().enabled = true;
		ungrab.GetComponent<Rigidbody>().AddForce(force);
	}

	public void MoveUpInQueue()
	{
		int oldQueueID = queuePositionID;

		foreach(Queue q in Queue.NodesInQueue)
		{
			if(debug) print (NPCName + " is searching the queue. ID " + q.queueID + " is occ ("+q.occupied+")" +
			       " and is less than " + queuePositionID + "?");

			if(q.queueID < queuePositionID && q.occupied == false)
			{
				queuePositionID = q.queueID;
				break;
			}
		}

		if(debug) print (NPCName + " used to be in queue pos " + oldQueueID
		       + " but now wants to be in position " + queuePositionID);

		Queue.NodesInQueue[queuePositionID-1].SetOccupied(true, this);
		Queue.NodesInQueue[oldQueueID-1].SetOccupied(false, null);

		ClearGoal();
		SetWants((int)wants.toQueue);
	}

	bool NearGoal(float customDist = 0)
	{
		float dist = 7;
		if(inside) dist = 4;
		if(customDist>0)
		{
			dist = customDist;
		}

		if((transform.position - GoalPosition).magnitude < dist)
		{
			return true;
		}

		return false;
	}

	void SetGoal(Vector3 newGoalPos)
	{
		GoalPosition = newGoalPos;
		pathToFollow = CreatePath(GoalPosition);

		for(int i=1; i<pathToFollow.Count; i++)
		{
			if(currentlyWants == wants.toExitScene) Debug.DrawLine(pathToFollow[i-1].transform.position, pathToFollow[i].transform.position, Color.blue, 10f);
		}
	}

	void ClearGoal()
	{
		GoalPosition = Vector3.zero;
		pathToFollow.Clear();
	}

	void WantsToEnter()
	{
		// init
		if(GoalPosition == Vector3.zero)
		{
			SetGoal(GameObject.Find("Enterance").transform.position);
		}

		// finish
		if(NearGoal())
		{
			ClearGoal();

			if(this == myNPCGroupLeader)
			{
				SetWants((int)wants.toQueue);

				foreach(NPC n in myNPCGroup)
				{
					if(n!=this) n.SetWants((int)wants.toWanderRestaurant);
				}
			}
			else
				SetWants((int)wants.toWanderRestaurant);
		}
	}

	void WantsToPanicBecauseFire()
	{
		if(waitStartTime == 0)
		{
			waitStartTime = Time.time;
			waitDuration = Random.Range(15, 30);
		}

		if(Random.value<0.008) GetComponent<Rigidbody>().constraints = RigidbodyConstraints.None;

		movementOrganisedByCurrentWant = true;


		if(debug)
		{
			print ( (transform.right - Vector3.up).magnitude);
		}

		if((transform.right - Vector3.up).magnitude < 0.8f || (transform.right - Vector3.up).magnitude > 1.2f)
		{
			GetComponent<Rigidbody>().AddForce(transform.right * currentSpeed * 20f * panicSpeedModifier * Time.deltaTime);
		}

		transform.Rotate(Vector3.up, 4f);

		/*
		if(Physics.Raycast(transform.position, transform.forward, 3f, pathfindLayerMask))
		{
			transform.Rotate(Vector3.up, Random.Range(45, 220));
		}
		*/

		if(Time.time>10 + waitStartTime)
		{
			currentUnmodifiedColour = materialStartColour;
			SetWants((int)previouslyWanted);
		}
	}

	void WantsToGetFood()
	{
		if(waitStartTime == 0)
		{
			waitStartTime = Time.time;
			waitDuration = Random.Range(15, 30);
		}
		
		if(Time.time>waitDuration + waitStartTime)
		{
			waitDuration = Random.Range(15, 30);
			anger += angerDamage + Random.Range(0,10);
			
			waitStartTime = Time.time;
		}
	}

	void WantsToFight()
	{
		if(GoalPosition == Vector3.zero)
		{
			if(interactWithThisNPC)
				SetGoal(interactWithThisNPC.transform.position);

			avoidNPCDesire = 1.4f;
		}

		if(interactWithThisNPC) GoalPosition = interactWithThisNPC.transform.position;

		if(interactWithThisNPC.currentlyWants == wants.toLeave)
		{
			ClearGoal();
			avoidNPCDesire = 0.4f;
			
			if(previouslyWanted != wants.toIdle) SetWants((int)previouslyWanted);
			else SetWants((int)wants.toWanderRestaurant);
			
			if(myNPCGroupLeader == this)
			{
				AssignGroupToTable();
			}
			
			interactWithThisNPC = null;
		}

		if(NearGoal(7f))
		{
			if(holding)
			{
				Vector3 force = ((interactWithThisNPC.transform.position + Vector3.up * 2) - holding.transform.position).normalized * currentSpeed * 50;
				Vector3 letGoPos = holding.transform.position;
				
				GetComponent<NetworkView>().RPC("LetGo", RPCMode.All, holding.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID, letGoPos, force);
			}
		}

		if(NearGoal(4))
		{
			if(debug) Debug.DrawLine(transform.position, interactWithThisNPC.transform.position, Color.red);

			if(holding)
			{
				Vector3 force = ((interactWithThisNPC.transform.position + Vector3.up * 2) - holding.transform.position).normalized * currentSpeed * 50;
				Vector3 letGoPos = holding.transform.position;

				GetComponent<NetworkView>().RPC("LetGo", RPCMode.All, holding.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID, letGoPos, force);
			}

			if(interactWithThisNPC.currentlyWants == wants.toLeave)
			{
				ClearGoal();
				avoidNPCDesire = 0.4f;

				if(previouslyWanted != wants.toIdle) SetWants((int)previouslyWanted);
				else SetWants((int)wants.toWanderRestaurant);

				if(myNPCGroupLeader == this)
				{
					AssignGroupToTable();
				}

				interactWithThisNPC = null;
			}
			else if(interactWithThisNPC.currentlyWants != wants.toFight)
			{
				interactWithThisNPC.interactWithThisNPC = this;
				interactWithThisNPC.ClearGoal();
				interactWithThisNPC.SetWants((int)wants.toFight);
			}
			else
			{
				if(waitStartTime == 0)
				{
					waitStartTime = Time.time;
					waitDuration = Random.Range(1, 6);
				}
				
				if(Time.time>waitDuration + waitStartTime)
				{
					Vector3 dir = (interactWithThisNPC.transform.position - transform.position).normalized;
					interactWithThisNPC.GetComponent<Rigidbody>().AddForce(dir * maxIndoorSpeed * 10 * Random.Range(1, 2.5f));
					interactWithThisNPC.anger += angerDamage + Random.Range(0,10);

					waitStartTime = Time.time;
				}
			}

			Vector3 newPos = transform.position;
			newPos.y = 3.8f;

			transform.position = Vector3.Lerp(transform.position, newPos, currentSpeed * Time.deltaTime);
		}
	}

	void WantsToGetToSeat()
	{
		if(GoalPosition == Vector3.zero)
		{
			SetGoal(seat.transform.position);
		}

		if(NearGoal(1))
		{
			ClearGoal();
			SetWants((int)wants.toGetFood);

			seat.SetTableOccupied(true, this);
			AddSpeechBubble(desiredFood, true);

			if(this == myNPCGroupLeader)
			{
				Vector3 letGoPos = seat.transform.position + seat.transform.up * 3f + seat.transform.forward * 4f;
				if(holding) GetComponent<NetworkView>().RPC("LetGo", RPCMode.All, holding.GetComponent<NetworkView>().viewID, GetComponent<NetworkView>().viewID, letGoPos, Vector3.zero);
			}
		}
	}
	
	void WantsToQueue()
	{
		if(GoalPosition == Vector3.zero)
		{
			Queue goalQueue = null;

			if(queuePositionID==-1)
			{
				foreach(Queue q in Queue.NodesInQueue)
				{
					if(!q.occupied)
					{
						goalQueue = q;
						queuePositionID = q.queueID;
						break;
					}
				}

				if(goalQueue)
					goalQueue.SetOccupied(true, this);
			}
			else
			{
				goalQueue = Queue.NodesInQueue[queuePositionID-1];
			}

			if(goalQueue!=null)
			{
				SetGoal(goalQueue.transform.position);
			}
			else
			{
				ClearGoal();
				SetWants((int)wants.toWanderRestaurant);
				anger += Random.Range(5,10);
			}

			//GenerateFoodOrderForGroup();
		}


		if(NearGoal(2))
		{
			currentSpeed = maxIndoorSpeed;

			if(queuePositionID == 1)
			{
				ClearGoal();

				SetWants((int)wants.toPlaceOrder);
			}
		}

	}

	void WantsToPlaceOrder()
	{
		if(GoalPosition == Vector3.zero)
		{
			if(myNPCGroupLeader == this)
				SetGoal(Queue.NodesInQueue[queuePositionID-1].transform.position);

			ElementCreateOrderOverview.OrderCreateComputer.npcInQueue = this;

			GenerateFoodOrderForGroup();
		}
	}

	void WantsToGetNumberStand()
	{

	}
	
	void WantsToLeave()
	{
		if(GoalPosition == Vector3.zero)
		{
			SetGoal(graph.enterance.transform.position);

			if(interactWithThisNPC) interactWithThisNPC = null;

			if(seat && myNPCGroupLeader == this)
			{
				UnassignGroupToTable();
			}
		}

		if(NearGoal())
		{
			ClearGoal();
			SetWants((int)wants.toExitScene);
		}
	}
	
	void WantsToExitScene()
	{
		if(GoalPosition == Vector3.zero)
		{
			SetGoal(graph.exits[Random.Range(0, graph.exits.Count)].transform.position);
		}
		
		if(inside) inside = false;

		if(NearGoal())
		{
			DespawnNPC();
		}
	}
	
	void WantsToIdle()
	{
		if(waitStartTime == 0)
		{
			waitStartTime = Time.time;
			waitDuration = Random.Range(1, 6);
		}

		if(Time.time>waitDuration + waitStartTime)
		{
			waitStartTime = 0;
			waitDuration = 0;

			SetWants((int)previouslyWanted);
		}
	}
	
	void WantsToEat()
	{
		
	}
	
	void WantsToWanderRestaurant()
	{
		if(!inside) inside = true;

		if(GoalPosition == Vector3.zero)
		{
			Vector3 rand = Random.insideUnitCircle * 4f;
			rand.y = 0;
			NavigationScript randNS = graph.insideNodes[Random.Range(0, graph.insideNodes.Count)];

			Vector3 newPos = new Vector3(randNS.transform.position.x + rand.x, randNS.transform.position.y, randNS.transform.position.z + rand.y);

			if(Physics.Linecast(randNS.transform.position, newPos))
			{
				rand = Vector3.zero;
			}

			SetGoal(newPos);
			currentSpeed = Random.Range(maxIndoorSpeed-5, maxIndoorSpeed);
		}
		
		if(NearGoal())
		{
			ClearGoal();

			if(previouslyWanted == wants.toQueue)
				SetWants((int)wants.toQueue);
			else
				SetWants((int)wants.toIdle);
		}
	}

	void UpdateGroupMembers()
	{
		myNPCGroup.Clear();

		myNPCGroup.Add(this);

		if(myNPCGroupLeader!=null)
		{
			// is the group leader
			if(myNPCGroupLeader == this)
			{
				foreach(NPC n in CurrentNPCs)
				{
					if(n != this && n.myNPCGroupLeader == this)
					{
						myNPCGroup.Add(n);
						n.UpdateGroupMembers();
					}
				}
			}
			else
			{
				foreach(NPC n in CurrentNPCs)
				{
					if(n != this && n.myNPCGroupLeader == myNPCGroupLeader)
					{
						myNPCGroup.Add(n);
					}
				}
			}
		}

		desiredGroupSize = myNPCGroup.Count;
	}
	
	Vector3 Seek(Vector3 Target)
	{
		Vector3 desiredVelocity = Target - transform.position;

		if(debug) Debug.DrawLine(transform.position, Target, Color.Lerp(Color.red, Color.yellow, 0.5f));

		return (desiredVelocity).normalized * currentSpeed;
	}

	Vector3 AvoidLocal()
	{
		Vector3 desiredVelocity = Vector3.zero;
		foreach(GameObject go in localDetect.ObjectsToAvoid)
		{
			desiredVelocity += go.transform.position;
		}

		if(localDetect.ObjectsToAvoid.Count>0) desiredVelocity /= localDetect.ObjectsToAvoid.Count;

		desiredVelocity.y = transform.position.y;

		if(debug) Debug.DrawLine(transform.position, transform.position + (transform.position - desiredVelocity).normalized * 3, Color.yellow);

		return (transform.position - desiredVelocity).normalized * currentSpeed;
	}

	Vector3 AvoidNPCs()
	{
		Vector3 desiredVelocity = Vector3.zero;
		int npcCount = 0;

		foreach(NPC n in CurrentNPCs)
		{
			float avoidDist = 4f;
			if(inside) avoidDist = 2.3f;
			if(myNPCGroup.Contains(n)) avoidDist = 0.6f;

			float dist = (n.transform.position - transform.position).magnitude;

			if(dist<avoidDist)
			{
				//float repulsion = currentMaxSpeed - (dist * 6f);

				desiredVelocity += n.transform.position;
				npcCount++;
			}
		}

		if(npcCount>0) desiredVelocity /= npcCount;

		if(debug) Debug.DrawLine(transform.position, transform.position + (transform.position - desiredVelocity).normalized * 4f, Color.blue);

		return (transform.position - desiredVelocity).normalized * currentSpeed;
	}

	List<NavigationScript> CreatePath(Vector3 targetPos)
	{				
		int startPath = -1;

		if(Random.value > 0.5f) startPath = FindClosestNode(transform.position);
		else startPath = FindRandNodeInRadius(transform.position, 6f);

		int endPath = FindClosestNode(targetPos);	
		
		if(startPath == -1)
		{
			print ("Error: no path found");
			startPath = 0;	
		}

		return graph.FindPath(startPath, endPath);
	}

	int FindRandNodeInRadius(Vector3 pos, float radius)
	{
		int randNode = -1;
		List<NavigationScript> possibleNodes = new List<NavigationScript>();

		foreach(NavigationScript node in graph.nodes)
		{
			float dist = (transform.position - node.transform.position).magnitude;

			if(dist < radius && !Physics.Linecast(pos, node.transform.position, pathfindLayerMask))
			{
				possibleNodes.Add(node);
			}
		}

		if(possibleNodes.Count>0)
		{
			int randNodeID = Random.Range(0, possibleNodes.Count);

			Debug.DrawLine(transform.position, possibleNodes[randNodeID].transform.position, Color.yellow, 10f);

			return possibleNodes[randNodeID].index;
		}

		print ("ERROR: could not find a random node within " + radius + " units");
		return -1;
	}
	
	int FindClosestNode(Vector3 pos)
	{
		float dist = 9999; // infinity
		int nearestNode = -1;

		foreach(NavigationScript node in graph.nodes)
		{
			if(!Physics.Linecast(pos, node.transform.position, pathfindLayerMask))
			{
				float angle = Vector3.Angle(transform.position, node.transform.position);

				// Make sure nearestNode isn't the start node
				if(angle > 220 && (node.transform.position - pos).magnitude < dist)
				{				
					dist = (node.transform.position - pos).magnitude;
					nearestNode = graph.nodes.IndexOf(node);
				}
			}
		}

		if(nearestNode == -1)
		{
			foreach(NavigationScript node in graph.nodes)
			{
				// Make sure nearestNode isn't the start node
				if(!Physics.Linecast(pos, node.transform.position, pathfindLayerMask))
				{
					if((node.transform.position - pos).magnitude < dist)
					{				
						dist = (node.transform.position - pos).magnitude;
						nearestNode = graph.nodes.IndexOf(node);
					}
				}
			}
		}

		if(nearestNode == -1) print("Error: no node found");
		
		return nearestNode;
	}
	
	[RPC]
	public void SetWants(int newWantID)
	{
		if(debug) print (NPCName + " wants " + (wants)newWantID + " / " + previouslyWanted);

		previouslyWanted = currentlyWants;
		currentlyWants = (wants)newWantID;
	}

	[RPC]
	public void SetGroupSize(NetworkViewID npcID, int newDesiredGroupSize)
	{
		NPC npc = NetworkView.Find(npcID).gameObject.GetComponent<NPC>();

		npc.desiredGroupSize = newDesiredGroupSize;
	}
	
	[RPC]
	void SetNPCTexture(NetworkViewID npcID, string textureName)
	{
		Transform NPC = NetworkView.Find(npcID).transform;
		
		NPC.GetComponent<Renderer>().material = Resources.Load("Skins/Materials/" + textureName) as Material;
	}
}
