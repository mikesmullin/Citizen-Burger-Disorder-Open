using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Rat : MonoBehaviour
{
	GraphScript graph;
	public List<NavigationScript> pathToFollow = new List<NavigationScript>();
	static List<Transform> avoidNodes = new List<Transform>();
	
	float maxSpeed = 500;
	
	public GameObject exitNode;

	Vector3 targetLocation = Vector3.zero;
	public PickupObject stolenFood;
	Transform targetFood;
	
	int pathfindLayerMask =  ~((1<<8) | (1<<9) | (1<<10) | (1<<11) | (1<<12) | (1<<13) | (1<<14));
	
	PickupObject myPickupObject;
	bool wasBeingHeld = false;
	
	float timeStuck = 0;
	float stuckDuration = 2f;
	float stuckCheckTime = 0;
	float stuckCheckWait = 2f;
	
	bool defeated = false;
	
	GameObject foodInSight;
	
	// Use this for initialization
	void Start ()
	{
		if(Network.isServer)
		{
			GetComponent<NetworkView>().RPC("SetSpeeds", RPCMode.AllBuffered, Random.Range(300f, maxSpeed), Random.Range(300, maxSpeed));
		
			graph = GameObject.Find("!RatGraph").GetComponent<GraphScript>();
			myPickupObject = GetComponent<PickupObject>();
			FindExit();
		}
	}

	// Update is called once per frame
	void Update ()
	{
		if(Network.isServer)
		{
			if(!GetComponent<Rigidbody>()) enabled = false;
			
			if(myPickupObject.beingHeld)
			{			
				wasBeingHeld = true;
				targetLocation = Vector3.zero;
			}
			else if(wasBeingHeld)
			{
				wasBeingHeld = false;

				GetComponent<NetworkView>().RPC("GiveUp", RPCMode.All, GetComponent<NetworkView>().viewID);

				CreatePath(exitNode.transform.position);
			}

			foodInSight = CanSeeFood();

			if((transform.position - targetLocation).magnitude < 3f && !foodInSight)
			{
//				print ("At target, there's no food.");
				targetLocation = Vector3.zero;
			}
			
			if(pathToFollow == null || pathToFollow.Count == 0)
			{
				// generate path
				if(targetLocation!=Vector3.zero)
				{
					CreatePath(targetLocation);
				}
				else
				{
					// generate path
					CreatePath(exitNode.transform.position);
				}
			}
			

				
			if((exitNode.transform.position - transform.position).magnitude < 15f)
			{
				if(stolenFood!=null)
				{
					GetComponent<NetworkView>().RPC("SetStolenFood", RPCMode.Others, GetComponent<NetworkView>().viewID, stolenFood.GetComponent<NetworkView>().viewID, false);
					this.stolenFood.DestroyObject();
				}
				
				FloorTrigger.currentRats--;

				Network.RemoveRPCs(this.gameObject.GetComponent<NetworkView>().viewID);
				Network.Destroy(this.gameObject);	
			}

			
			if(stolenFood==null && targetFood==null && foodInSight && !defeated)
			{
				targetFood = foodInSight.transform;
			}

			// run for food if nearby and doesn't already have food
			if(targetFood && stolenFood==null && !defeated)
			{
				Vector3 directionToMove = Vector3.zero;
				Vector3 directionToLook = Vector3.zero;
				
				directionToMove += Seek(targetFood.transform.position);
				directionToMove += Avoid();
				directionToLook = directionToMove;
				directionToLook.y = 0;		
				
				if(GetComponent<NetworkView>().isMine)
				{
					if(directionToMove!=Vector3.zero)
					{
						transform.rotation = Quaternion.LookRotation(directionToLook + transform.forward);
					}
						
					GetComponent<Rigidbody>().AddForce(directionToMove.normalized * maxSpeed * 10 * Time.deltaTime);
				}

				// steal food if there is food to steal and rat hasn't been beaten
				if(!defeated && targetFood && (transform.position - targetFood.position).magnitude<4f)
				{
					Food stealing = targetFood.GetComponent<Food>();
					
					if(stealing.beingHeldByRat && Random.value > 0.5f)
					{
						GetComponent<NetworkView>().RPC("GiveUp", RPCMode.All, stealing.beingHeldByRat.GetComponent<NetworkView>().viewID);	
					}
					
					if(targetFood && stealing)
					{
						stealing.beingHeldByRat = this;

						GetComponent<NetworkView>().RPC("SetStolenFood", RPCMode.All, GetComponent<NetworkView>().viewID, targetFood.GetComponent<NetworkView>().viewID, true);

						if(FloorTrigger.foodDropPosition.Contains(targetFood.gameObject)) FloorTrigger.foodDropPosition.Remove(targetFood.gameObject);

						targetLocation = Vector3.zero;
						CreatePath(exitNode.transform.position);
						targetFood = null;
					}
				}
			}
			// there is no food, or rat has been defeated by another rat
			else
			{
				if(pathToFollow!=null && pathToFollow.Count>0)
				{
					// remove the Y axis from calculation as rats are generally at ground level
					Vector2 positionXZ = new Vector2(transform.position.x, transform.position.z);
					Vector2 nodePositionXZ = new Vector2(pathToFollow[0].transform.position.x, pathToFollow[0].transform.position.z);

					float distance = (positionXZ - nodePositionXZ).magnitude;
					
					if(distance < 4f)
					{
						pathToFollow.RemoveAt(0);	
					}
					
					Vector3 directionToMove = Vector3.zero;
					Vector3 directionToLook = Vector3.zero;
					
					if(pathToFollow.Count>0)
					{
						directionToMove += Seek(pathToFollow[0].transform.position);
						directionToMove += Avoid();
						directionToLook = directionToMove;
						directionToLook.y = 0;	
					}
					else
					{
						directionToMove += Seek(targetLocation);
						directionToMove += Avoid();
						directionToLook = directionToMove;
						directionToLook.y = 0;	
					}		
						
					if(directionToMove!=Vector3.zero)
					{
						transform.rotation = Quaternion.LookRotation(directionToLook + transform.forward);
					}
						
					GetComponent<Rigidbody>().AddForce(directionToMove.normalized * maxSpeed * 10 * Time.deltaTime);
				}
			}
		}
	}
	
	void FixedUpdate()
	{
		if(stolenFood)
		{
			if(Network.isServer)
			{
				if(stolenFood.beingHeld)
				{
					GetComponent<NetworkView>().RPC("GiveUp", RPCMode.All, GetComponent<NetworkView>().viewID);
				}
			}

			stolenFood.transform.position = transform.position + transform.forward;	
		}	
	}

	[RPC]
	void SetStolenFood(NetworkViewID ratID, NetworkViewID foodID, bool ratIsHolding)
	{
		Rat targetRat = NetworkView.Find(ratID).GetComponent<Rat>();
		PickupObject food = NetworkView.Find(foodID).GetComponent<PickupObject>();

		if(ratIsHolding)
		{
			targetRat.stolenFood = food;

			targetRat.stolenFood.GetComponent<Rigidbody>().useGravity = false;
			targetRat.stolenFood.transform.GetComponent<Rigidbody>().GetComponent<Collider>().enabled = false;
			targetRat.stolenFood.GetComponent<Food>().beingHeldByRat = targetRat;
		}
		else
		{
			targetRat.stolenFood.transform.GetComponent<Rigidbody>().useGravity = true;
			targetRat.stolenFood.transform.GetComponent<Rigidbody>().GetComponent<Collider>().enabled = true;
			targetRat.stolenFood.GetComponent<Food>().beingHeldByRat = null;


			targetRat.stolenFood = null;
		}
	}

	[RPC]
	void GiveUp(NetworkViewID ratToGiveUp)
	{
		Rat targetRat = NetworkView.Find(ratToGiveUp).GetComponent<Rat>();

		if(targetRat.stolenFood)
		{
			print ("Stolen food!");
			GetComponent<NetworkView>().RPC("SetStolenFood", RPCMode.All, ratToGiveUp, targetRat.stolenFood.GetComponent<NetworkView>().viewID, false);
		}

		targetRat.targetFood = null;
		targetRat.targetLocation = Vector3.zero;
		targetRat.defeated = true;
	}
	
	[RPC]
	void SetSpeeds(float baseSpeed, float maxSpeed)
	{
		this.maxSpeed = maxSpeed;
	}
	
	void LateUpdate()
	{
		if(Network.isServer)
		{
			if(stuckCheckTime == 0 || timeStuck > 0)
			{
				if(timeStuck == 0 && !Physics.Raycast(transform.position + transform.up * 0.5f, transform.forward, 1, pathfindLayerMask))
				{
					timeStuck = Time.time;
					stuckCheckTime = timeStuck;
				}
		
				if(timeStuck > 0 && Physics.Raycast(transform.position + transform.up * 0.5f, transform.forward, 1, pathfindLayerMask))
				{
			//		print("unstuck");
					timeStuck = 0;
					stuckCheckTime = Time.time;
				}
			}
			
			if(stuckCheckTime > 0 && Time.time > stuckCheckTime + stuckCheckWait)
			{
				stuckCheckTime = 0;
			}
			
			if(timeStuck>0 && Time.time > timeStuck + stuckDuration)
			{
				if(targetLocation!=Vector3.zero) CreatePath(targetLocation);
				else CreatePath(exitNode.transform.position);	
				
				timeStuck = 0;
				stuckCheckTime = Time.time;
			}
		}
	}
	
	[RPC]
	void SyncFoodInSight(NetworkViewID foodID)
	{
		GameObject foodToSync = NetworkView.Find(foodID).gameObject;
		
		foodInSight = foodToSync;
	}
	
	GameObject CanSeeFood()
	{
		GameObject foodTarget;
		Collider[] colliders = Physics.OverlapSphere(transform.position, 10f);
		RaycastHit hit;
		
		foreach(Collider c in colliders)
		{
			if(c.GetComponent<Food>() && !c.name.Contains("rat"))
			{
				Food f = c.GetComponent<Food>();

				if(f.foodBeenOnFloor && !f.inFood && f.GetBurgerStack() == null && f.type != Food.FoodType.bun)
				{


					if(Physics.Linecast(transform.position, c.transform.position, out hit, pathfindLayerMask))
					{
						if(hit.collider == c)
						{
							if(Mathf.Abs(transform.position.y - c.transform.position.y) < 10f)
							{
								foodTarget = c.gameObject;
								return foodTarget;
							}
						}
					}
				}
			}
		}
		
		return null;
	}

	Vector3 Avoid()
	{
		Vector3 desiredVelocity = Vector3.zero;

		if(avoidNodes == null || avoidNodes.Count==0)
		{
			foreach(Transform t in GameObject.Find("!AvoidNodes").transform)
			{
				avoidNodes.Add(t);	

			}
		}

		foreach(Transform avoid in avoidNodes)
		{
			if((transform.position - avoid.position).magnitude < 3f)
			{
				desiredVelocity += (transform.position - avoid.position).normalized * maxSpeed*0.5f*((3-(transform.position - avoid.position).magnitude)/3f);
			}
		}

		return desiredVelocity;
	}
	
	Vector3 Seek(Vector3 Target)
	{
		Vector3 desiredVelocity = Vector3.zero;
		
		if(GetComponent<Rigidbody>()) desiredVelocity = ((Target - transform.position).normalized * maxSpeed) - GetComponent<Rigidbody>().velocity;
		
		return desiredVelocity;
	}
	
	public void SetTargetFood(Vector3 targetPos)
	{
		targetLocation = targetPos;
	}
	
	public void CreatePath(Vector3 targetPos)
	{
		int start = FindClosestVisibleNode(transform);
		int end = FindClosestNode(targetPos);
		
		if(start==-1)
		{
			print ("Can't find closest");
			transform.LookAt(graph.nodes[FindClosestNode(transform.position)].transform.position);
			
			start = FindClosestVisibleNode(transform);
		}
		
		pathToFollow = graph.FindPath(start, end);
		
		/*
		foreach(NavigationScript ns in pathToFollow)
		{
			if(pathToFollow.IndexOf(ns)<pathToFollow.Count-1)
			{
				Debug.DrawLine(ns.transform.position, pathToFollow[pathToFollow.IndexOf(ns)+1].transform.position, Color.green, 20f);
			}
		}
		*/
	}
			
	int FindClosestNode(Vector3 pos)
	{
		float dist = 9999; // infinity
		int nearestNode = -1;
		
		foreach(NavigationScript node in graph.nodes)
		{
			// Make sure nearestNode isn't the start node
			if((node.transform.position - pos).magnitude < dist)
			{				
				dist = (node.transform.position - pos).magnitude;
				nearestNode = graph.nodes[graph.nodes.IndexOf(node)].index;
			}
		}
		
		if(nearestNode == -1) print("Error: no node found");
		
		return nearestNode;
	}
	
	public void FindExit(bool excludeNearestExit=false)
	{
		// The exit node is a node that is minDist away from this object's spawn
		// Lazy way to do this but I don't want to spend much time on a pretty boring system
		GameObject[] exitArray = GameObject.FindGameObjectsWithTag("Despawner");
		List<GameObject> newExitList = new List<GameObject>();
		float closestDist = 99999;
		int closestNodeID = 0;
		
		for(int i=0; i<exitArray.Length; i++)
		{
			newExitList.Add(exitArray[i]);	
			if((transform.position - exitArray[i].transform.position).magnitude < closestDist)
			{
				closestDist = (transform.position - exitArray[i].transform.position).magnitude;
				closestNodeID = i;
			}
		}
		
		if(excludeNearestExit && newExitList.Count>1) newExitList.RemoveAt(closestNodeID);
		
		exitNode = newExitList[Random.Range(0, newExitList.Count)];
	}
	
	int FindClosestVisibleNode(Transform t)
	{
		float distFromNode = 9999; // infinity
		int nearestNode = -1;
		
		foreach(NavigationScript node in graph.nodes)
		{
			// can the npc see the node?
			if(!Physics.Linecast(t.position, node.transform.position, pathfindLayerMask))
			{	
				if((node.transform.position - t.position).magnitude < distFromNode)
				{					
					// Make sure the node isn't the one the npc is standing on
					if((node.transform.position - transform.position).magnitude > 0.5f)
					{
						distFromNode = (node.transform.position - t.position).magnitude;
						nearestNode = graph.nodes[graph.nodes.IndexOf(node)].index;
					}
				}
			}
		}
		
		if(nearestNode == -1) print("Error: no visible node found");
		
		return nearestNode;
	}
}
