using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class NavigationScript : MonoBehaviour {

	public int index;
	public List<int> edges;
	float maxEdgeLength = 50F;
	
	GraphScript graph;

	public void CalcEdges()
	{
		GraphScript graph = transform.parent.GetComponent<GraphScript>();
		edges = new List<int>();
		
		int layerMask = ~((1<<8) | (1<<12) | (1<<13));
		
		foreach(NavigationScript node in graph.nodes)
		{
			if(graph.nodes.IndexOf(node)!=graph.nodes.IndexOf(this))
			{
				float dist = (node.transform.position - transform.position).magnitude;

				if(dist<maxEdgeLength)
				{
					RaycastHit hit;
					if(!Physics.SphereCast(transform.position, 0.9F, (node.transform.position - transform.position).normalized, out hit, (node.transform.position - transform.position).magnitude, layerMask))
					{
						edges.Add(graph.nodes.IndexOf(node));	
						
					//	Debug.DrawLine(transform.position, node.transform.position, Color.green, 4f);
					}
				}
			}
		}
	}
}
